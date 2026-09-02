import { Effect, Option } from "effect"
import {
  anchorFor,
  rowsForRange,
  WHOLE_FILE,
  type Patch,
  type Side,
} from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { UnknownFile, UnselectableRange } from "./error.ts"
import { patches as patchesIn } from "./branches.ts"

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

export const anchor = Effect.fn("Review.Diff.anchor")(function* (worktree: Worktree, request: Ranged) {
  const only = yield* patchesIn(worktree, WHOLE_FILE, request.file)
  const found = only.length > 0 ? only : yield* patchesIn(worktree, WHOLE_FILE)
  const patch = findPatch(found, request.file)

  const resolved = yield* Option.match(patch, {
    onNone: () =>
      new UnknownFile({ file: request.file, known: found.map((candidate) => candidate.path) }),
    onSome: Effect.succeed,
  })

  const anchored = Option.flatMap(rowsForRange(resolved, request), ([first, last]) =>
    anchorFor(resolved, first, last, request.side),
  )

  return yield* Option.match(anchored, {
    onNone: () => new UnselectableRange({ file: request.file, start: request.start, end: request.end }),
    onSome: Effect.succeed,
  })
})

export const list = patchesIn

export const source = Effect.fn("Review.Diff.source")(function* (worktree: Worktree, file: string) {
  const git = yield* Git
  const found = yield* git.source(worktree, file)
  return Option.getOrElse(found, (): ReadonlyArray<string> => [])
})

export const before = Effect.fn("Review.Diff.before")(function* (worktree: Worktree, file: string) {
  const git = yield* Git
  const found = yield* git.blob(worktree, file)
  return Option.getOrElse(found, (): ReadonlyArray<string> => [])
})
