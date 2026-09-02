import { Effect, Option } from "effect"
import { foundAgain, WHOLE_FILE, type Patch, type Side } from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { codeBlocks, type Layer } from "../domain/layers/index.ts"
import {
  Store,
  type Batch,
  type StoreUnreadable,
  type StoreUnwritable,
} from "../service/store/index.ts"
import { UnknownComment, type UnknownWorktree } from "./error.ts"
import { realOf, type BranchReading } from "./branches.ts"
import { anchor } from "./patches.ts"

const POLL = "500 millis"

export type CommentRequest = {
  readonly file: string
  readonly start: number
  readonly end: number
  readonly body: string
  readonly side: Side
  readonly id: string
  readonly at: string
  readonly remark?: string | undefined
}

export type ReplyRequest = {
  readonly to: string
  readonly body: string
  readonly id: string
  readonly at: string
}

export type Turn = {
  readonly voice: "reviewer" | "agent"
  readonly body: string
}

export type PendingComment = {
  readonly id: string
  readonly at: string
  readonly head: string
  readonly file: string
  readonly side: Side
  readonly start: number
  readonly end: number
  readonly snippet: string
  readonly body: string
  readonly placed?: boolean | undefined
  readonly replyTo?: string | undefined
  readonly layer?: string | undefined
  readonly thread?: ReadonlyArray<Turn> | undefined
}

export type Written = readonly [CommentRequest, ...ReadonlyArray<CommentRequest>]

const bodyOf = (entry: { readonly body: string }): string => entry.body

const saidTo = (
  spoken: ReadonlyArray<{ readonly comment: string }>,
  id: string,
): number => spoken.filter((entry) => entry.comment === id).length

type Spoken = {
  readonly comment: string
  readonly body: string
  readonly asks: boolean
  readonly at: string
}

type Conversation = {
  readonly spoken: ReadonlyArray<Spoken>
  readonly settled: Readonly<Record<string, string>>
  readonly removed: Readonly<Record<string, string>>
  readonly head: string
  readonly shown: ReadonlySet<string>
  readonly read: Readonly<Record<string, number>>
  readonly taken: Readonly<Record<string, string>>
}

type Spun = {
  readonly voice: "reviewer" | "agent"
  readonly body: string
  readonly at: string
  readonly asks: boolean
}

const spunOf = (
  replies: ReadonlyArray<PendingComment>,
  said: ReadonlyArray<Spoken>,
): ReadonlyArray<Spun> =>
  [
    ...replies.map((reply) => ({ voice: "reviewer" as const, body: reply.body, at: reply.at, asks: false })),
    ...said.map((entry) => ({ voice: "agent" as const, body: entry.body, at: entry.at, asks: entry.asks })),
  ].toSorted((one, other) => (one.at < other.at ? -1 : one.at > other.at ? 1 : 0))

const sentOf = (
  comment: PendingComment,
  replies: ReadonlyArray<PendingComment>,
  conversation: Conversation,
) => {
  const { spoken, settled, removed, head, shown, read, taken } = conversation
  const ids = new Set([comment.id, ...replies.map((reply) => reply.id)])
  const said = spoken.filter((entry) => ids.has(entry.comment))
  const seen = [...ids].reduce((total, id) => total + (read[id] ?? 0), 0)
  const spun = spunOf(replies, said)
  const last = spun.at(-1)
  const takenAt = [...ids].flatMap((id) => taken[id] ?? []).toSorted().at(-1)
  return {
    id: comment.id,
    at: comment.at,
    file: comment.file,
    side: comment.side,
    start: comment.start,
    end: comment.end,
    body: comment.body,
    snippet: comment.snippet,
    settled: Object.hasOwn(settled, comment.id),
    removed: Object.hasOwn(removed, comment.id),
    stale: comment.head !== head,
    outside: !shown.has(comment.file) || comment.placed === false,
    unread: Math.max(0, said.length - seen),
    asks: last?.voice === "agent" && last.asks,
    ...(takenAt === undefined ? {} : { takenAt }),
    answers: said.map(bodyOf),
    turns: spun.map((turn) => ({ voice: turn.voice, body: turn.body }) satisfies Turn),
  }
}

const placedNow = (
  patches: ReadonlyArray<Patch>,
  comment: PendingComment,
): PendingComment => {
  const patch = patches.find((candidate) => candidate.path === comment.file)
  if (patch === undefined) return { ...comment, placed: false }
  if (comment.start === WHOLE_FILE) return { ...comment, placed: false }
  if (comment.snippet.trim().length === 0) return { ...comment, placed: true }
  return Option.match(foundAgain(patch, comment), {
    onNone: () => ({ ...comment, placed: false }),
    onSome: (range) => ({ ...comment, start: range.start, end: range.end, placed: true }),
  })
}

const linesIn = (found: Option.Option<ReadonlyArray<string>>): ReadonlyArray<string> =>
  Option.getOrElse(found, (): ReadonlyArray<string> => [])

const trimmedLines = (snippet: string): ReadonlyArray<string> =>
  snippet
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

const NAMES_SOMETHING = /[A-Za-z0-9_$]{3}/

const worthMatching = (wanted: ReadonlyArray<string>): boolean =>
  wanted.length > 1 || (wanted[0] !== undefined && NAMES_SOMETHING.test(wanted[0]))

const blockAt = (
  source: ReadonlyArray<string>,
  wanted: ReadonlyArray<string>,
  at: number,
): boolean => wanted.every((line, step) => (source[at + step] ?? "").trim() === line)

const wholeSnippetIn = (
  source: ReadonlyArray<string>,
  wanted: ReadonlyArray<string>,
  was: number,
): number | undefined => {
  const found = source.flatMap((_, at) =>
    blockAt(source, wanted, at) ? [at + wanted.length] : [],
  )
  if (found.length === 0) return undefined
  return found.reduce((best, line) => (Math.abs(line - was) < Math.abs(best - was) ? line : best))
}

const stillInFile = (
  comment: PendingComment,
  source: ReadonlyArray<string>,
): PendingComment => {
  const wanted = trimmedLines(comment.snippet)
  if (!worthMatching(wanted)) return comment
  const line = wholeSnippetIn(source, wanted, comment.end)
  if (line === undefined) return comment
  const span = Math.max(0, comment.end - comment.start)
  return { ...comment, start: line - span, end: line, placed: true }
}

const foundOutsideTheHunks = Effect.fn("Review.Comment.foundOutsideTheHunks")(function* (
  worktree: Worktree,
  held: ReadonlyArray<PendingComment>,
  shown: ReadonlySet<string>,
) {
  const wanted = held.filter(
    (comment) =>
      comment.placed === false &&
      shown.has(comment.file) &&
      comment.start !== WHOLE_FILE &&
      comment.snippet.trim().length > 0,
  )
  if (wanted.length === 0) return held
  const git = yield* Git
  const paths = [...new Set(wanted.map((comment) => comment.file))]
  const readOne = (path: string) =>
    Effect.map(git.source(worktree, path), (found) => [path, linesIn(found)] as const)
  const read = yield* Effect.forEach(paths, readOne)
  const sources = new Map(read)
  const asked = new Set(wanted.map((comment) => comment.id))
  return held.map((comment) =>
    asked.has(comment.id) ? stillInFile(comment, sources.get(comment.file) ?? []) : comment,
  )
})

const flatten = (batches: ReadonlyArray<Batch>): ReadonlyArray<PendingComment> =>
  batches.flatMap((batch) =>
    batch.comments.map((comment) => ({
      id: comment.id,
      at: batch.at,
      head: batch.head,
      file: comment.anchor.path,
      side: comment.anchor.side,
      start: comment.anchor.start,
      end: comment.anchor.end,
      snippet: comment.anchor.snippet,
      body: comment.body,
      replyTo: comment.replyTo,
    })),
  )

export const listSent = Effect.fn("Review.Comment.listSent")(function* (reading: BranchReading) {
  const store = yield* Store
  const worktree = reading.worktree
  const spoken = yield* store.answers(worktree.path)
  const current = yield* store.state(worktree.path)
  const shown = new Set(reading.patches.map((patch) => patch.path))
  const placed = flatten(yield* store.inbox(worktree.path)).map((comment) =>
    placedNow(reading.patches, comment),
  )
  const held = yield* foundOutsideTheHunks(worktree, placed, shown)
  const replies = held.filter((comment) => comment.replyTo !== undefined)
  const conversation = {
    spoken,
    settled: current.settled,
    removed: current.removed,
    head: worktree.head,
    shown,
    read: current.read,
    taken: current.taken ?? {},
  }
  const under = (comment: PendingComment): ReadonlyArray<PendingComment> =>
    replies.filter((reply) => reply.replyTo === comment.id)
  return held
    .filter((comment) => comment.replyTo === undefined)
    .map((comment) => sentOf(comment, under(comment), conversation))
})

export const submitMany = Effect.fn("Review.Comment.submitMany")(function* (
  worktree: Worktree,
  requests: Written,
) {
  const store = yield* Store
  const anchoring = Effect.fn("Review.Comment.anchoring")(function* (request: CommentRequest) {
    const anchored = yield* anchor(worktree, request)
    return {
      id: request.id,
      anchor: anchored,
      body: request.body,
      ...(request.remark === undefined ? {} : { remark: request.remark }),
    }
  })
  const anchored = yield* Effect.forEach(requests, anchoring)
  const batch: Batch = {
    id: requests[0].id,
    at: requests[0].at,
    head: worktree.head,
    comments: anchored,
  }
  yield* store.submit(worktree.path, batch)
  return batch
})

export const submit = Effect.fn("Review.Comment.submit")(function* (
  worktree: Worktree,
  request: CommentRequest,
) {
  return yield* submitMany(worktree, [request])
})

const without = (
  held: Readonly<Record<string, string>>,
  key: string,
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(held).filter(([held_]) => held_ !== key))

export const reply = Effect.fn("Review.Comment.reply")(function* (
  worktree: Worktree,
  request: ReplyRequest,
) {
  const store = yield* Store
  const batches = yield* store.inbox(worktree.path)
  const found = batches.flatMap((batch) => batch.comments).find((one) => one.id === request.to)
  if (found === undefined) return yield* new UnknownComment({ id: request.to })
  const root = found.replyTo ?? found.id
  const batch: Batch = {
    id: request.id,
    at: request.at,
    head: worktree.head,
    comments: [{ id: request.id, anchor: found.anchor, body: request.body, replyTo: root }],
  }
  yield* store.submit(worktree.path, batch)
  const current = yield* store.state(worktree.path)
  if (Object.hasOwn(current.settled, root)) {
    yield* store.changeState(worktree.path, (was) => ({
      ...was,
      settled: without(was.settled, root),
    }))
  }
  return batch
})

const threadBefore = (
  replied: PendingComment,
  held: ReadonlyArray<PendingComment>,
  spoken: ReadonlyArray<Spoken>,
): ReadonlyArray<Turn> => {
  const root = replied.replyTo
  const mine = held.filter((one) => one.id === root || one.replyTo === root)
  const ids = new Set(mine.map((one) => one.id))
  const said = spoken.filter((entry) => ids.has(entry.comment))
  return spunOf(
    mine.filter((one) => one.at < replied.at),
    said.filter((entry) => entry.at < replied.at),
  ).map((turn) => ({ voice: turn.voice, body: turn.body }) satisfies Turn)
}

const layerOver = (
  layers: ReadonlyArray<Layer>,
  comment: PendingComment,
): string | undefined => {
  const over = layers.flatMap((layer) =>
    codeBlocks(layer)
      .filter(
        (block) =>
          block.path === comment.file &&
          comment.start <= block.end &&
          comment.end >= block.start,
      )
      .map((block) => ({ title: layer.title, room: block.end - block.start })),
  )
  return over.reduce<{ title: string; room: number } | undefined>(
    (tightest, one) => (tightest === undefined || one.room < tightest.room ? one : tightest),
    undefined,
  )?.title
}

const layersOn = Effect.fn("Review.Comment.layersOn")(function* (worktree: string) {
  const store = yield* Store
  const found = yield* store.layers(worktree)
  return Option.match(found, {
    onNone: () => [] as ReadonlyArray<Layer>,
    onSome: (held) => held.layers,
  })
})

export const take = Effect.fn("Review.Comment.take")(function* (worktreePath: string) {
  const store = yield* Store
  const resolved = yield* realOf(worktreePath)
  const at = new Date().toISOString()
  yield* Effect.ignore(store.noteWatching(resolved, at))
  const owed = flatten(yield* store.take(resolved, at))
  if (owed.length === 0) return owed
  const layers = yield* layersOn(resolved)
  const under = (one: PendingComment): PendingComment => {
    const title = layerOver(layers, one)
    return title === undefined ? one : Object.assign({}, one, { layer: title })
  }
  if (owed.every((one) => one.replyTo === undefined)) return owed.map(under)
  const held = flatten(yield* store.inbox(resolved))
  const spoken = yield* store.answers(resolved)
  const carried = (one: PendingComment): PendingComment =>
    one.replyTo === undefined ? one : Object.assign({}, one, { thread: threadBefore(one, held, spoken) })
  return owed.map(carried).map(under)
})

export const awaitTaken = (
  worktreePath: string,
  deadline: number,
): Effect.Effect<
  ReadonlyArray<PendingComment>,
  StoreUnreadable | StoreUnwritable | UnknownWorktree,
  Store
> =>
  take(worktreePath).pipe(
    Effect.flatMap((comments) =>
      comments.length > 0 || Date.now() >= deadline
        ? Effect.succeed(comments)
        : Effect.sleep(POLL).pipe(Effect.flatMap(() => awaitTaken(worktreePath, deadline))),
    ),
  )

export const markRead = Effect.fn("Review.Comment.markRead")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  const spoken = yield* store.answers(worktree.path)
  const held = flatten(yield* store.inbox(worktree.path))
  const ids = [id, ...held.filter((one) => one.replyTo === id).map((one) => one.id)]
  const counted = ids.map((one) => ({ id: one, seen: saidTo(spoken, one) }))
  const current = yield* store.state(worktree.path)
  const owed = counted.filter((one) => (current.read[one.id] ?? 0) < one.seen)
  if (owed.length === 0) return { id, unread: 0 }
  const read = { ...current.read }
  for (const one of owed) read[one.id] = one.seen
  yield* store.changeState(worktree.path, (was) => ({ ...was, read }))
  return { id, unread: 0 }
})
