import { realpath } from "node:fs/promises"
import { Effect, Option } from "effect"
import { anchorFor, lineOn, parsePatches, type Patch, type Side } from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { isVouched, vouch } from "../domain/review/index.ts"
import { Store, type Batch, type StoreUnreadable, type StoreUnwritable } from "../service/store/index.ts"
import { UnknownBranch, UnknownFile, UnselectableRange } from "./error.ts"

const CONTEXT = 3
const POLL = "500 millis"

export type BranchSummary = {
  readonly branch: string
  readonly path: string
  readonly head: string
  readonly files: number
  readonly added: number
  readonly removed: number
}

export type CommentRequest = {
  readonly repo: string
  readonly branch: string
  readonly file: string
  readonly start: number
  readonly end: number
  readonly body: string
  readonly side: Side
  readonly id: string
  readonly at: string
}

const findBranch = Effect.fn("Cli.findBranch")(function* (repo: string, branch: string) {
  const git = yield* Git
  const worktrees = yield* git.worktrees(repo)
  const found = worktrees.find((worktree) => worktree.branch === branch)
  return yield* found === undefined
    ? new UnknownBranch({ repo, branch, known: worktrees.map((w) => w.branch) })
    : Effect.succeed(found)
})

const patchesOf = Effect.fn("Cli.patchesOf")(function* (worktree: Worktree) {
  const git = yield* Git
  const raw = yield* git.diff(worktree, CONTEXT)
  return parsePatches(raw)
})

const findPatch = (patches: ReadonlyArray<Patch>, file: string): Option.Option<Patch> =>
  Option.fromNullishOr(patches.find((patch) => patch.path === file))

const rowsCovering = (
  patch: Patch,
  side: Side,
  start: number,
  end: number,
): ReadonlyArray<number> =>
  patch.rows
    .filter((row) =>
      Option.match(lineOn(row, side), {
        onNone: () => false,
        onSome: (line) => line >= start && line <= end,
      }),
    )
    .map((row) => row.index)

export const listBranches = Effect.fn("Cli.listBranches")(function* (repo: string) {
  const git = yield* Git
  const worktrees = yield* git.worktrees(repo)
  const summaries: Array<BranchSummary> = []
  for (const worktree of worktrees) {
    const stat = yield* git.stat(worktree)
    summaries.push({
      branch: worktree.branch,
      path: worktree.path,
      head: worktree.head,
      files: stat.files,
      added: stat.added,
      removed: stat.removed,
    })
  }
  return summaries.filter((summary) => summary.files > 0)
})

export type VouchRequest = {
  readonly repo: string
  readonly branch: string
  readonly file: string
}

export type VouchReport = {
  readonly vouched: ReadonlyArray<string>
  readonly total: number
}

const blobOf = (patches: ReadonlyArray<Patch>, file: string): Option.Option<string> =>
  Option.map(findPatch(patches, file), (patch) => patch.blob)

export const toggleVouch = Effect.fn("Cli.toggleVouch")(function* (request: VouchRequest) {
  const store = yield* Store
  const worktree = yield* findBranch(request.repo, request.branch)
  const patches = yield* patchesOf(worktree)

  const blob = yield* Option.match(blobOf(patches, request.file), {
    onNone: () =>
      new UnknownFile({ file: request.file, known: patches.map((patch) => patch.path) }),
    onSome: Effect.succeed,
  })

  const current = yield* store.state(worktree.path)
  const next = vouch(current.vouches, request.file, blob)
  yield* store.saveState(worktree.path, { ...current, vouches: next })

  const files = patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((file) => isVouched(next, file.path, file.blob)).map((file) => file.path),
    total: patches.length,
  } satisfies VouchReport
})

export const reviewProgress = Effect.fn("Cli.reviewProgress")(function* (
  repo: string,
  branch: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  const patches = yield* patchesOf(worktree)
  const current = yield* store.state(worktree.path)
  const files = patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((file) => isVouched(current.vouches, file.path, file.blob)).map((f) => f.path),
    total: patches.length,
  } satisfies VouchReport
})

export const submitComment = Effect.fn("Cli.submitComment")(function* (request: CommentRequest) {
  const store = yield* Store
  const worktree = yield* findBranch(request.repo, request.branch)
  const patches = yield* patchesOf(worktree)
  const patch = findPatch(patches, request.file)

  const resolved = yield* Option.match(patch, {
    onNone: () =>
      new UnknownFile({ file: request.file, known: patches.map((candidate) => candidate.path) }),
    onSome: Effect.succeed,
  })

  const rows = rowsCovering(resolved, request.side, request.start, request.end)
  const first = rows[0]
  const last = rows.at(-1)
  const anchor =
    first === undefined || last === undefined ? Option.none() : anchorFor(resolved, first, last)

  const chosen = yield* Option.match(anchor, {
    onNone: () => new UnselectableRange({ file: request.file, start: request.start, end: request.end }),
    onSome: Effect.succeed,
  })

  const batch: Batch = {
    id: request.id,
    at: request.at,
    head: worktree.head,
    comments: [{ id: request.id, anchor: chosen, body: request.body }],
  }
  yield* store.submit(worktree.path, batch)
  return batch
})

export const listPatches = Effect.fn("Cli.listPatches")(function* (repo: string, branch: string) {
  const worktree = yield* findBranch(repo, branch)
  return yield* patchesOf(worktree)
})

export type PendingComment = {
  readonly at: string
  readonly head: string
  readonly file: string
  readonly side: Side
  readonly start: number
  readonly end: number
  readonly snippet: string
  readonly body: string
}

const flatten = (batches: ReadonlyArray<Batch>): ReadonlyArray<PendingComment> =>
  batches.flatMap((batch) =>
    batch.comments.map((comment) => ({
      at: batch.at,
      head: batch.head,
      file: comment.anchor.path,
      side: comment.anchor.side,
      start: comment.anchor.start,
      end: comment.anchor.end,
      snippet: comment.anchor.snippet,
      body: comment.body,
    })),
  )

export const takeComments = Effect.fn("Cli.takeComments")(function* (worktree: string) {
  const store = yield* Store
  const resolved = yield* Effect.promise(() => realpath(worktree))
  return flatten(yield* store.take(resolved))
})

export const awaitComments = (
  worktree: string,
  deadline: number,
): Effect.Effect<ReadonlyArray<PendingComment>, StoreUnreadable | StoreUnwritable, Store> =>
  takeComments(worktree).pipe(
    Effect.flatMap((comments) =>
      comments.length > 0 || Date.now() >= deadline
        ? Effect.succeed(comments)
        : Effect.sleep(POLL).pipe(Effect.flatMap(() => awaitComments(worktree, deadline))),
    ),
  )
