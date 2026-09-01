import { Effect, Option } from "effect"
import { isVouched, vouch } from "../domain/review/index.ts"
import { Store } from "../service/store/index.ts"
import { UnknownFile } from "./error.ts"
import { type BranchReading, readingOf } from "./branches.ts"
import { blobOf } from "./patches.ts"

export type VouchRequest = {
  readonly repo: string
  readonly branch: string
  readonly file: string
}

export type VouchReport = {
  readonly vouched: ReadonlyArray<string>
  readonly parts: ReadonlyArray<string>
  readonly total: number
}

export type ProgressReport = VouchReport

export const readParts = (
  parts: Readonly<Record<string, string>>,
  files: ReadonlyArray<{ readonly path: string; readonly blob: string }>,
): ReadonlyArray<string> => {
  const blobs = new Map(files.map((file) => [file.path, file.blob]))
  return Object.entries(parts)
    .filter(([part, blob]) => blobs.get(part.split("@")[0] ?? "") === blob)
    .map(([part]) => part)
}

export const vouchIn = Effect.fn("Review.vouchIn")(function* (reading: BranchReading, file: string) {
  const store = yield* Store
  const patches = reading.patches

  const blob = yield* Option.match(blobOf(patches, file), {
    onNone: () => new UnknownFile({ file, known: patches.map((patch) => patch.path) }),
    onSome: Effect.succeed,
  })

  const current = yield* store.state(reading.worktree.path)
  const next = vouch(current.vouches, file, blob)
  yield* store.changeState(reading.worktree.path, (was) => ({
    ...was,
    vouches: vouch(was.vouches, file, blob),
  }))

  const files = patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((one) => isVouched(next, one.path, one.blob)).map((one) => one.path),
    parts: readParts(current.parts, files),
    total: patches.length,
  } satisfies VouchReport
})

export const toggleVouch = Effect.fn("Review.toggleVouch")(function* (request: VouchRequest) {
  return yield* vouchIn(yield* readingOf(request.repo, request.branch), request.file)
})

export const progressIn = Effect.fn("Review.progressIn")(function* (reading: BranchReading) {
  const store = yield* Store
  const current = yield* store.state(reading.worktree.path)
  const files = reading.patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((file) => isVouched(current.vouches, file.path, file.blob)).map((f) => f.path),
    parts: readParts(current.parts, files),
    total: reading.patches.length,
  }
})

export const reviewProgress = Effect.fn("Review.reviewProgress")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  return yield* progressIn(yield* readingOf(repo, branch, base))
})
