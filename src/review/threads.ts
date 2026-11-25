import { Effect } from "effect"
import { Store, type Batch, type StoredAnswer, type StoreUnreadable } from "../service/store/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { ThreadOpen, UnknownComment } from "./error.ts"
import type { BranchReading } from "./branches.ts"
import { placedAll, type Placed } from "./placing.ts"
import { isMovedPast, isOpen, louderOf, sectionOf, standOf, type ThreadSection, type ThreadStand } from "../domain/review/index.ts"

export const ASK_LEAD = "About this branch, not about this line."

export type ThreadAnswer = {
  readonly body: string
  readonly at: string
  readonly asks: boolean
  readonly choices?: ReadonlyArray<string>
}

export type ThreadDoing = {
  readonly body: string
  readonly at: string
}

export type Thread = {
  readonly id: string
  readonly file: string
  readonly side: string
  readonly start: number
  readonly end: number
  readonly snippet: string
  readonly body: string
  readonly at: string
  readonly state: string
  readonly stale: boolean
  readonly outdated: boolean
  readonly outside: boolean
  readonly reworded: boolean
  readonly movedPast: boolean
  readonly stand: ThreadStand
  readonly section: ThreadSection
  readonly about: "branch" | "line"
  readonly settleable: boolean
  readonly unread: number
  readonly taken: boolean
  readonly answers: ReadonlyArray<ThreadAnswer>
  readonly turns: ReadonlyArray<ThreadTurn>
  readonly settled: boolean
  readonly layers?: ReadonlyArray<number>
  readonly doing?: ThreadDoing
}

export type ThreadTurn = {
  readonly voice: "reviewer" | "agent"
  readonly body: string
  readonly at: string
  readonly choices?: ReadonlyArray<string>
}

export type AnswerRequest = {
  readonly id: string
  readonly body: string
  readonly asks: boolean
  readonly at: string
  readonly choices: ReadonlyArray<string>
}

export type DoingRequest = {
  readonly id: string
  readonly body: string
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
  readonly places: ReadonlyMap<string, Placed>
  readonly read: Readonly<Record<string, number>>
  readonly taken: Readonly<Record<string, string>>
  readonly doing: Readonly<Record<string, ThreadDoing>>
}

const choicesOf = (entry: StoredAnswer): { readonly choices?: ReadonlyArray<string> } =>
  entry.choices === undefined ? {} : { choices: entry.choices }

const answerOf = (entry: StoredAnswer): ThreadAnswer => ({
  body: entry.body,
  at: entry.at,
  asks: entry.asks,
  ...choicesOf(entry),
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
    ...said.map((entry) => ({ voice: "agent" as const, body: entry.body, at: entry.at, ...choicesOf(entry) })),
  ].toSorted((one, other) => (one.at < other.at ? -1 : one.at > other.at ? 1 : 0))

type Judged = Pick<Thread, "state" | "outside" | "outdated" | "reworded" | "taken" | "unread" | "settled"> & {
  readonly asks: boolean
  readonly answers: number
  readonly agentLast: boolean
}

const judged = (facts: Judged) => {
  const removed = facts.state === "removed"
  const stand = standOf({
    removed,
    settled: facts.settled,
    asks: facts.asks,
    answeredLast: facts.agentLast && facts.answers > 0,
    taken: facts.taken,
  })
  const movedPast = isMovedPast(facts)
  return {
    movedPast,
    stand,
    section: sectionOf(stand, movedPast),
    settleable: facts.answers > 0 && facts.unread === 0 && !facts.settled && !removed,
  }
}

type Gathered = {
  readonly held: Held
  readonly ids: ReadonlySet<string>
  readonly mine: ReadonlyArray<StoredAnswer>
  readonly turns: ReadonlyArray<ThreadTurn>
  readonly sits: Placed
  readonly settled: boolean
  readonly seen: number
}

const factsOf = (gathered: Gathered, conversation: Conversation) => {
  const { held, ids, mine, turns, sits, settled, seen } = gathered
  const path = held.comment.anchor.path
  const agentLast = turns.at(-1)?.voice === "agent"
  const asked = mine.at(-1)?.asks === true
  return {
    state: stateOf(turns, asked, settled, Object.hasOwn(conversation.removed, held.comment.id)),
    outdated: sits.placed && sits.outdated,
    outside: !conversation.shown.has(path) || !sits.placed,
    reworded: sits.placed && sits.reworded,
    unread: Math.max(0, mine.length - seen),
    taken: [...ids].some((id) => Object.hasOwn(conversation.taken, id)),
    settled,
    asks: agentLast && asked,
    answers: mine.length,
    agentLast,
  }
}

const threadOf = (held: Held, replies: ReadonlyArray<Held>, conversation: Conversation): Thread => {
  const { comment, batch } = held
  const ids = new Set([comment.id, ...replies.map((one) => one.comment.id)])
  const mine = conversation.answers.filter((entry) => ids.has(entry.comment))
  const seen = [...ids].reduce((total, id) => total + (conversation.read[id] ?? 0), 0)
  const turns = turnsOf(replies, mine)
  const settled = Object.hasOwn(conversation.settled, comment.id)
  const sits = conversation.places.get(comment.id) ?? { ...comment.anchor, placed: false, outdated: false, reworded: false }
  const doing = conversation.doing[comment.id]
  const facts = factsOf({ held, ids, mine, turns, sits, settled, seen }, conversation)
  return {
    id: comment.id,
    file: comment.anchor.path,
    side: comment.anchor.side,
    start: sits.start,
    end: sits.end,
    snippet: comment.anchor.snippet,
    body: comment.body,
    at: batch.at,
    state: facts.state,
    stale: batch.head !== conversation.head,
    outdated: facts.outdated,
    outside: facts.outside,
    reworded: facts.reworded,
    ...judged(facts),
    about: comment.body.startsWith(ASK_LEAD) ? "branch" : "line",
    unread: facts.unread,
    taken: facts.taken,
    answers: mine.map(answerOf),
    turns,
    settled,
    ...(doing === undefined ? {} : { doing }),
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

const rootIn = (batches: ReadonlyArray<Batch>, id: string): string | undefined => {
  const found = batches.flatMap((batch) => batch.comments).find((comment) => comment.id === id)
  return found === undefined ? undefined : (found.replyTo ?? found.id)
}

const rootOf = Effect.fn("Review.Thread.rootOf")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  const root = rootIn(yield* store.inbox(worktree.path), id)
  return root === undefined ? yield* new UnknownComment({ id }) : root
})

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
  const batches = yield* store.inbox(worktree.path)
  const roots = batches.flatMap((batch) => batch.comments).filter((comment) => comment.replyTo === undefined)
  const placed = yield* placedAll(worktree, patches, roots.map((comment) => comment.anchor))
  const places = new Map(roots.map((comment, at) => [comment.id, placed[at] ?? { ...comment.anchor, placed: false, outdated: false, reworded: false }]))
  return threadsIn(batches, {
    answers: yield* store.answers(worktree.path),
    settled: current.settled,
    removed: current.removed,
    head: worktree.head,
    shown: new Set(patches.map((patch) => patch.path)),
    places,
    read: current.read,
    taken: current.taken ?? {},
    doing: current.doing,
  })
})

const clearDoing = Effect.fn("Review.Thread.clearDoing")(function* (worktree: Worktree, root: string) {
  const store = yield* Store
  const current = yield* store.state(worktree.path)
  if (!Object.hasOwn(current.doing, root)) return
  yield* store.changeState(worktree.path, (was) => ({ ...was, doing: without(was.doing, root) }))
})

export const doing = Effect.fn("Review.Thread.doing")(function* (
  worktree: Worktree,
  request: DoingRequest,
) {
  const store = yield* Store
  const root = yield* rootOf(worktree, request.id)
  const said = { body: request.body, at: request.at }
  yield* store.changeState(worktree.path, (was) => ({ ...was, doing: { ...was.doing, [root]: said } }))
  yield* Effect.ignore(store.noteWatching(worktree.path, request.at))
  return { doing: { id: root, ...said } }
})

export const answer = Effect.fn("Review.Thread.answer")(function* (
  worktree: Worktree,
  request: AnswerRequest,
) {
  const store = yield* Store
  const root = yield* rootOf(worktree, request.id)
  const offered = request.choices.length > 0
  yield* store.answer(worktree.path, {
    comment: request.id,
    body: request.body,
    head: worktree.head,
    asks: request.asks || offered,
    at: request.at,
    ...(offered ? { choices: request.choices } : {}),
  })
  yield* clearDoing(worktree, root)
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
    doing: without(was.doing, id),
  }))
  return { settled: id }
})

const without = <held>(
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
    taken: without(was.taken ?? {}, id),
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
    doing: without(was.doing, id),
  }))
  return { removed: id }
})

export const restore = Effect.fn("Review.Thread.restore")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  yield* known(worktree, id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    removed: without(was.removed, id),
    taken: without(was.taken ?? {}, id),
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

export type ThreadCounts = {
  readonly asked: number
  readonly unread: number
}

export const countsOf = (threads: ReadonlyArray<Thread>): ThreadCounts => ({
  asked: threads.filter((thread) => thread.stand === "asked").length,
  unread: threads.filter((thread) => isOpen(thread.stand) && thread.stand !== "asked" && thread.unread > 0).length,
})

export type FileThreads = {
  readonly path: string
  readonly open: number
  readonly settled: number
  readonly stand: ThreadStand
}

export type LineThreads = {
  readonly path: string
  readonly side: string
  readonly line: number
  readonly open: number
  readonly settled: number
  readonly stand: ThreadStand
}

const loudestOf = (threads: ReadonlyArray<Thread>): ThreadStand =>
  threads.reduce<ThreadStand>((stand, one) => louderOf(stand, one.stand), "gone")

const drawnOnALine = (thread: Thread): boolean =>
  thread.about === "line" && !thread.movedPast && thread.stand !== "gone"

const settledOnALine = (thread: Thread): boolean => thread.stand === "settled" && !thread.movedPast

const fileThreads = (path: string, threads: ReadonlyArray<Thread>): FileThreads => {
  const here = threads.filter((thread) => thread.file === path)
  const open = here.filter((thread) => isOpen(thread.stand))
  return {
    path,
    open: open.length,
    settled: here.filter(settledOnALine).length,
    stand: open.length > 0 ? loudestOf(open) : "settled",
  }
}

export const byFile = (threads: ReadonlyArray<Thread>): ReadonlyArray<FileThreads> => {
  const counted = threads.filter(
    (thread) => drawnOnALine(thread) && (isOpen(thread.stand) || thread.stand === "settled"),
  )
  return [...new Set(counted.map((thread) => thread.file))].map((path) => fileThreads(path, counted))
}

const lineThreads = (here: ReadonlyArray<Thread>, first: Thread): LineThreads => ({
  path: first.file,
  side: first.side,
  line: first.end,
  open: here.filter((thread) => isOpen(thread.stand)).length,
  settled: here.filter((thread) => thread.stand === "settled").length,
  stand: loudestOf(here),
})

export const byLine = (threads: ReadonlyArray<Thread>): ReadonlyArray<LineThreads> => {
  const lines = new Map<string, Array<Thread>>()
  for (const thread of threads.filter(drawnOnALine)) {
    const key = [thread.file, thread.side, thread.end].join("\u0000")
    lines.set(key, [...(lines.get(key) ?? []), thread])
  }
  return [...lines.values()].flatMap((here) => (here[0] === undefined ? [] : [lineThreads(here, here[0])]))
}
