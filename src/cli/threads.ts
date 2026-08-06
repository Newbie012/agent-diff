import { Effect } from "effect"
import { Store, type Batch, type StoredAnswer } from "../service/store/index.ts"
import { findBranch } from "./commands.ts"
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
  readonly answers: ReadonlyArray<ThreadAnswer>
}

const stateOf = (
  answers: ReadonlyArray<StoredAnswer>,
  isSettled: boolean,
  isRemoved: boolean,
): Thread["state"] => {
  if (isRemoved) return "removed"
  if (isSettled) return "done"
  const last = answers.at(-1)
  if (last === undefined) return "submitted"
  return last.asks ? "question" : "answered"
}

type Reading = {
  readonly answers: ReadonlyArray<StoredAnswer>
  readonly settled: Readonly<Record<string, string>>
  readonly removed: Readonly<Record<string, string>>
  readonly head: string
}

const spoken = (entry: StoredAnswer): ThreadAnswer => ({
  body: entry.body,
  at: entry.at,
  asks: entry.asks,
})

const threadOf = (
  comment: Batch["comments"][number],
  batch: Batch,
  reading: Reading,
): Thread => {
  const mine = reading.answers.filter((entry) => entry.comment === comment.id)
  return {
    id: comment.id,
    file: comment.anchor.path,
    side: comment.anchor.side,
    start: comment.anchor.start,
    end: comment.anchor.end,
    body: comment.body,
    state: stateOf(
      mine,
      Object.hasOwn(reading.settled, comment.id),
      Object.hasOwn(reading.removed, comment.id),
    ),
    stale: batch.head !== reading.head,
    answers: mine.map(spoken),
  }
}

const threadsIn = (batches: ReadonlyArray<Batch>, reading: Reading): ReadonlyArray<Thread> =>
  batches.flatMap((batch) => batch.comments.map((comment) => threadOf(comment, batch, reading)))

const idsIn = (batches: ReadonlyArray<Batch>): ReadonlyArray<string> =>
  batches.flatMap((batch) => batch.comments.map((comment) => comment.id))

const isKnown = Effect.fn("Cli.isKnown")(function* (worktreePath: string, id: string) {
  const store = yield* Store
  return idsIn(yield* store.inbox(worktreePath)).includes(id)
})

export const listThreads = Effect.fn("Cli.listThreads")(function* (repo: string, branch: string) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  const current = yield* store.state(worktree.path)
  return threadsIn(yield* store.inbox(worktree.path), {
    answers: yield* store.answers(worktree.path),
    settled: current.settled,
    removed: current.removed,
    head: worktree.head,
  })
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
  const answers = yield* store.answers(worktree.path)
  return { answered: answers.filter((entry) => entry.comment === request.id).length }
})

export const settleThread = Effect.fn("Cli.settleThread")(function* (
  repo: string,
  branch: string,
  id: string,
  at: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  if (!(yield* isKnown(worktree.path, id))) return yield* new UnknownComment({ id })
  const current = yield* store.state(worktree.path)
  yield* store.saveState(worktree.path, {
    ...current,
    settled: { ...current.settled, [id]: at },
  })
  return { settled: id }
})

export const removeComment = Effect.fn("Cli.removeComment")(function* (
  repo: string,
  branch: string,
  id: string,
  at: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  if (!(yield* isKnown(worktree.path, id))) return yield* new UnknownComment({ id })
  const current = yield* store.state(worktree.path)
  yield* store.saveState(worktree.path, {
    ...current,
    removed: { ...current.removed, [id]: at },
  })
  return { removed: id }
})

const without = (
  entries: Readonly<Record<string, string>>,
  id: string,
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(entries).filter(([key]) => key !== id))

export const restoreComment = Effect.fn("Cli.restoreComment")(function* (
  repo: string,
  branch: string,
  id: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  if (!(yield* isKnown(worktree.path, id))) return yield* new UnknownComment({ id })
  const current = yield* store.state(worktree.path)
  yield* store.saveState(worktree.path, { ...current, removed: without(current.removed, id) })
  return { restored: id }
})
