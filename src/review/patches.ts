import { Effect, Option } from "effect"
import {
  anchorFor,
  parsePatches,
  rowsForRange,
  WHOLE_FILE,
  type Patch,
  type Side,
} from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { UnknownFile, UnselectableRange } from "./error.ts"
import { CONTEXT, findBranch, patchesOf } from "./branches.ts"

const findPatch = (patches: ReadonlyArray<Patch>, file: string): Option.Option<Patch> =>
  Option.fromNullishOr(patches.find((patch) => patch.path === file))

export const blobOf = (patches: ReadonlyArray<Patch>, file: string): Option.Option<string> =>
  Option.map(findPatch(patches, file), (patch) => patch.blob)

export type Ranged = {
  readonly file: string
  readonly start: number
  readonly end: number
  readonly side: Side
}

export const anchorIn = Effect.fn("Review.anchorIn")(function* (
  worktree: Worktree,
  request: Ranged,
) {
  const only = yield* patchesOf(worktree, WHOLE_FILE, request.file)
  const patches = only.length > 0 ? only : yield* patchesOf(worktree, WHOLE_FILE)
  const patch = findPatch(patches, request.file)

  const resolved = yield* Option.match(patch, {
    onNone: () =>
      new UnknownFile({ file: request.file, known: patches.map((candidate) => candidate.path) }),
    onSome: Effect.succeed,
  })

  const anchor = Option.flatMap(rowsForRange(resolved, request), ([first, last]) =>
    anchorFor(resolved, first, last, request.side),
  )

  return yield* Option.match(anchor, {
    onNone: () => new UnselectableRange({ file: request.file, start: request.start, end: request.end }),
    onSome: Effect.succeed,
  })
})

export const listPatches = Effect.fn("Review.listPatches")(function* (
  repo: string,
  branch: string,
  context = CONTEXT,
  only?: string,
) {
  const worktree = yield* findBranch(repo, branch)
  const git = yield* Git
  return parsePatches(yield* git.diff(worktree, context, only))
})

export const patchIn = Effect.fn("Review.patchIn")(function* (
  worktree: Worktree,
  context: number,
  only?: string,
) {
  const git = yield* Git
  return parsePatches(yield* git.diff(worktree, context, only))
})

export const fileSource = Effect.fn("Review.fileSource")(function* (
  repo: string,
  branch: string,
  file: string,
) {
  const git = yield* Git
  const worktree = yield* findBranch(repo, branch)
  const found = yield* git.source(worktree, file)
  return Option.getOrElse(found, (): ReadonlyArray<string> => [])
})

export const fileBefore = Effect.fn("Review.fileBefore")(function* (
  repo: string,
  branch: string,
  file: string,
) {
  const git = yield* Git
  const worktree = yield* findBranch(repo, branch)
  const found = yield* git.blob(worktree, file)
  return Option.getOrElse(found, (): ReadonlyArray<string> => [])
})
