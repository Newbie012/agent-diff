import { Effect, Option } from "effect"
import { foundAgain, type Patch } from "../domain/patch/index.ts"
import { Store, type Batch, type StoredAnswer, type StoreUnreadable } from "../service/store/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { ThreadOpen, UnknownComment } from "./error.ts"
import type { BranchReading } from "./branches.ts"

export type ThreadAnswer = {
  readonly body: string
  readonly at: string
  readonly asks: boolean
}

export type Thread = {
  readonly id: string
  readonly file: string
  readonly side: string
  readonly start: number
  readonly end: number
  readonly body: string
  readonly state: string
  readonly stale: boolean
  readonly outside: boolean
  readonly unread: number
  readonly answers: ReadonlyArray<ThreadAnswer>
  readonly turns: ReadonlyArray<ThreadTurn>
  readonly settled: boolean
}

export type ThreadTurn = {
  readonly voice: "reviewer" | "agent"
  readonly body: string
  readonly at: string
}

export type AnswerRequest = {
  readonly id: string
  readonly body: string
  readonly asks: boolean
  readonly at: string
}

const stateOf = (
  turns: ReadonlyArray<ThreadTurn>,
  asked: boolean,
  isSettled: boolean,
  isRemoved: boolean,
): Thread["state"] => {
  if (isRemoved) return "removed"
  if (isSettled) return "done"
  const last = turns.at(-1)
  if (last === undefined || last.voice === "reviewer") return "sent"
  return asked ? "question" : "answered"
}

type Held = {
  readonly comment: Batch["comments"][number]
  readonly batch: Batch
}

type Conversation = {
  readonly answers: ReadonlyArray<StoredAnswer>
  readonly settled: Readonly<Record<string, string>>
  readonly removed: Readonly<Record<string, string>>
  readonly head: string
  readonly shown: ReadonlySet<string>
  readonly patches: ReadonlyArray<Patch>
  readonly read: Readonly<Record<string, number>>
}

const placedNow = (
  patches: ReadonlyArray<Patch>,
  anchor: Batch["comments"][number]["anchor"],
): { readonly start: number; readonly end: number; readonly placed: boolean } => {
  const patch = patches.find((candidate) => candidate.path === anchor.path)
  if (patch === undefined) return { ...anchor, placed: false }
  if (anchor.snippet.trim().length === 0) return { ...anchor, placed: true }
  return Option.match(foundAgain(patch, anchor), {
    onNone: () => ({ ...anchor, placed: false }),
    onSome: (range) => ({ ...range, placed: true }),
  })
}

const answerOf = (entry: StoredAnswer): ThreadAnswer => ({
  body: entry.body,
  at: entry.at,
  asks: entry.asks,
})

const turnsOf = (
  replies: ReadonlyArray<Held>,
  said: ReadonlyArray<StoredAnswer>,
): ReadonlyArray<ThreadTurn> =>
  [
    ...replies.map((held) => ({
      voice: "reviewer" as const,
      body: held.comment.body,
      at: held.batch.at,
    })),
    ...said.map((entry) => ({ voice: "agent" as const, body: entry.body, at: entry.at })),
  ].toSorted((one, other) => (one.at < other.at ? -1 : one.at > other.at ? 1 : 0))

const threadOf = (held: Held, replies: ReadonlyArray<Held>, conversation: Conversation): Thread => {
  const { comment, batch } = held
  const ids = new Set([comment.id, ...replies.map((one) => one.comment.id)])
  const mine = conversation.answers.filter((entry) => ids.has(entry.comment))
  const seen = [...ids].reduce((total, id) => total + (conversation.read[id] ?? 0), 0)
  const turns = turnsOf(replies, mine)
  const settled = Object.hasOwn(conversation.settled, comment.id)
  const sits = placedNow(conversation.patches, comment.anchor)
  return {
    id: comment.id,
    file: comment.anchor.path,
    side: comment.anchor.side,
    start: sits.start,
    end: sits.end,
    body: comment.body,
    state: stateOf(turns, mine.at(-1)?.asks === true, settled, Object.hasOwn(conversation.removed, comment.id)),
    stale: batch.head !== conversation.head,
    outside: !conversation.shown.has(comment.anchor.path) || !sits.placed,
    unread: Math.max(0, mine.length - seen),
    answers: mine.map(answerOf),
    turns,
    settled,
  }
}

const threadsIn = (batches: ReadonlyArray<Batch>, conversation: Conversation): ReadonlyArray<Thread> => {
  const held = batches.flatMap((batch) => batch.comments.map((comment) => ({ comment, batch })))
  const replies = held.filter((one) => one.comment.replyTo !== undefined)
  const under = (one: Held): ReadonlyArray<Held> =>
    replies.filter((reply) => reply.comment.replyTo === one.comment.id)
  return held
    .filter((one) => one.comment.replyTo === undefined)
    .map((one) => threadOf(one, under(one), conversation))
}

const idsIn = (batches: ReadonlyArray<Batch>): ReadonlyArray<string> =>
  batches.flatMap((batch) => batch.comments.map((comment) => comment.id))

const isKnown = Effect.fn("Review.Thread.isKnown")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  return idsIn(yield* store.inbox(worktree.path)).includes(id)
})

const known = (
  worktree: Worktree,
  id: string,
): Effect.Effect<void, UnknownComment | StoreUnreadable, Store> =>
  Effect.flatMap(isKnown(worktree, id), (found) =>
    found ? Effect.void : new UnknownComment({ id }),
  )

export const list = Effect.fn("Review.Thread.list")(function* (reading: BranchReading) {
  const store = yield* Store
  const { worktree, patches } = reading
  const current = yield* store.state(worktree.path)
  return threadsIn(yield* store.inbox(worktree.path), {
    answers: yield* store.answers(worktree.path),
    settled: current.settled,
    removed: current.removed,
    head: worktree.head,
    shown: new Set(patches.map((patch) => patch.path)),
    patches,
    read: current.read,
  })
})

export const answer = Effect.fn("Review.Thread.answer")(function* (
  worktree: Worktree,
  request: AnswerRequest,
) {
  const store = yield* Store
  yield* known(worktree, request.id)
  yield* store.answer(worktree.path, {
    comment: request.id,
    body: request.body,
    head: worktree.head,
    asks: request.asks,
    at: request.at,
  })
  yield* Effect.ignore(store.noteWatching(worktree.path, request.at))
  const answers = yield* store.answers(worktree.path)
  return { answered: answers.filter((entry) => entry.comment === request.id).length }
})

const repliesTo = Effect.fn("Review.Thread.repliesTo")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  return (yield* store.answers(worktree.path)).filter((entry) => entry.comment === id).length
})

export const settle = Effect.fn("Review.Thread.settle")(function* (
  worktree: Worktree,
  id: string,
  at: string,
) {
  const store = yield* Store
  yield* known(worktree, id)
  const replies = yield* repliesTo(worktree, id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    settled: { ...was.settled, [id]: at },
    read: { ...was.read, [id]: replies },
  }))
  return { settled: id }
})

const without = <held extends string | number>(
  entries: Readonly<Record<string, held>>,
  id: string,
): Readonly<Record<string, held>> =>
  Object.fromEntries(Object.entries(entries).filter(([key]) => key !== id))

export const unsettle = Effect.fn("Review.Thread.unsettle")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  yield* known(worktree, id)
  const held = yield* store.state(worktree.path)
  if (!Object.hasOwn(held.settled, id)) return yield* new ThreadOpen({ id })
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    settled: without(was.settled, id),
    read: without(was.read, id),
  }))
  return { unsettled: id }
})

export const remove = Effect.fn("Review.Thread.remove")(function* (
  worktree: Worktree,
  id: string,
  at: string,
) {
  const store = yield* Store
  yield* known(worktree, id)
  const replies = yield* repliesTo(worktree, id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    removed: { ...was.removed, [id]: at },
    read: { ...was.read, [id]: replies },
  }))
  return { removed: id }
})

export const restore = Effect.fn("Review.Thread.restore")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  yield* known(worktree, id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    removed: without(was.removed, id),
  }))
  return { restored: id }
})

export const settleRead = Effect.fn("Review.Thread.settleRead")(function* (
  worktree: Worktree,
  at: string,
) {
  const store = yield* Store
  const current = yield* store.state(worktree.path)
  const voiced = yield* store.answers(worktree.path)
  const answered = (id: string): number => voiced.filter((entry) => entry.comment === id).length
  const ripe = idsIn(yield* store.inbox(worktree.path)).filter((id) => {
    const said = answered(id)
    return (
      said > 0 &&
      (current.read[id] ?? 0) >= said &&
      !Object.hasOwn(current.settled, id) &&
      !Object.hasOwn(current.removed, id)
    )
  })
  if (ripe.length === 0) return { settled: 0 }
  const now = Object.fromEntries(ripe.map((id) => [id, at]))
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    settled: { ...was.settled, ...now },
  }))
  return { settled: ripe.length }
})
