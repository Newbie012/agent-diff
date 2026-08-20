import { Effect } from "effect"
import { Store, type Batch, type StoredAnswer } from "../service/store/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { findBranch, patchesOf } from "./commands.ts"
import { worktreeAt } from "./layers.ts"
import { UnknownComment } from "./error.ts"

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

type Reading = {
  readonly answers: ReadonlyArray<StoredAnswer>
  readonly settled: Readonly<Record<string, string>>
  readonly removed: Readonly<Record<string, string>>
  readonly head: string
  readonly shown: ReadonlySet<string>
  readonly read: Readonly<Record<string, number>>
}

const spoken = (entry: StoredAnswer): ThreadAnswer => ({
  body: entry.body,
  at: entry.at,
  asks: entry.asks,
})

type Held = {
  readonly comment: Batch["comments"][number]
  readonly batch: Batch
}

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

const threadOf = (held: Held, replies: ReadonlyArray<Held>, reading: Reading): Thread => {
  const { comment, batch } = held
  const ids = new Set([comment.id, ...replies.map((one) => one.comment.id)])
  const mine = reading.answers.filter((entry) => ids.has(entry.comment))
  const seen = [...ids].reduce((total, id) => total + (reading.read[id] ?? 0), 0)
  const turns = turnsOf(replies, mine)
  const settled = Object.hasOwn(reading.settled, comment.id)
  return {
    id: comment.id,
    file: comment.anchor.path,
    side: comment.anchor.side,
    start: comment.anchor.start,
    end: comment.anchor.end,
    body: comment.body,
    state: stateOf(turns, mine.at(-1)?.asks === true, settled, Object.hasOwn(reading.removed, comment.id)),
    stale: batch.head !== reading.head,
    outside: !reading.shown.has(comment.anchor.path),
    unread: Math.max(0, mine.length - seen),
    answers: mine.map(spoken),
    turns,
    settled,
  }
}

const threadsIn = (batches: ReadonlyArray<Batch>, reading: Reading): ReadonlyArray<Thread> => {
  const held = batches.flatMap((batch) => batch.comments.map((comment) => ({ comment, batch })))
  const replies = held.filter((one) => one.comment.replyTo !== undefined)
  const under = (one: Held): ReadonlyArray<Held> =>
    replies.filter((reply) => reply.comment.replyTo === one.comment.id)
  return held
    .filter((one) => one.comment.replyTo === undefined)
    .map((one) => threadOf(one, under(one), reading))
}

const idsIn = (batches: ReadonlyArray<Batch>): ReadonlyArray<string> =>
  batches.flatMap((batch) => batch.comments.map((comment) => comment.id))

const isKnown = Effect.fn("Cli.isKnown")(function* (worktreePath: string, id: string) {
  const store = yield* Store
  return idsIn(yield* store.inbox(worktreePath)).includes(id)
})

export const listThreads = Effect.fn("Cli.listThreads")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch, base)
  const current = yield* store.state(worktree.path)
  const sent = threadsIn(yield* store.inbox(worktree.path), {
    answers: yield* store.answers(worktree.path),
    settled: current.settled,
    removed: current.removed,
    head: worktree.head,
    shown: new Set((yield* patchesOf(worktree)).map((patch: { path: string }) => patch.path)),
    read: current.read,
  })
  return sent
})

export const answerComment = Effect.fn("Cli.answerComment")(function* (request: {
  readonly worktree: string
  readonly id: string
  readonly body: string
  readonly asks: boolean
  readonly at: string
}) {
  const store = yield* Store
  const worktree = yield* worktreeAt(request.worktree)
  if (!(yield* isKnown(worktree.path, request.id))) {
    return yield* new UnknownComment({ id: request.id })
  }
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

export const settleIn = Effect.fn("Cli.settleIn")(function* (
  worktree: Worktree,
  id: string,
  at: string,
) {
  const store = yield* Store
  if (!(yield* isKnown(worktree.path, id))) return yield* new UnknownComment({ id })
  const replies = (yield* store.answers(worktree.path)).filter((entry) => entry.comment === id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    settled: { ...was.settled, [id]: at },
    read: { ...was.read, [id]: replies.length },
  }))
  return { settled: id }
})

export const settleThread = Effect.fn("Cli.settleThread")(function* (
  repo: string,
  branch: string,
  id: string,
  at: string,
) {
  return yield* settleIn(yield* findBranch(repo, branch), id, at)
})

export const removeIn = Effect.fn("Cli.removeIn")(function* (
  worktree: Worktree,
  id: string,
  at: string,
) {
  const store = yield* Store
  if (!(yield* isKnown(worktree.path, id))) return yield* new UnknownComment({ id })
  const replies = (yield* store.answers(worktree.path)).filter((entry) => entry.comment === id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    removed: { ...was.removed, [id]: at },
    read: { ...was.read, [id]: replies.length },
  }))
  return { removed: id }
})

export const removeComment = Effect.fn("Cli.removeComment")(function* (
  repo: string,
  branch: string,
  id: string,
  at: string,
) {
  return yield* removeIn(yield* findBranch(repo, branch), id, at)
})

const without = (
  entries: Readonly<Record<string, string>>,
  id: string,
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(entries).filter(([key]) => key !== id))

export const restoreIn = Effect.fn("Cli.restoreIn")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  if (!(yield* isKnown(worktree.path, id))) return yield* new UnknownComment({ id })
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    removed: without(was.removed, id),
  }))
  return { restored: id }
})

export const restoreComment = Effect.fn("Cli.restoreComment")(function* (
  repo: string,
  branch: string,
  id: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  if (!(yield* isKnown(worktree.path, id))) return yield* new UnknownComment({ id })
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    removed: without(was.removed, id),
  }))
  return { restored: id }
})

export const settleRead = Effect.fn("Cli.settleRead")(function* (
  repo: string,
  branch: string,
  at: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
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
