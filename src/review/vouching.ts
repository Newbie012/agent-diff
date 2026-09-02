import { Effect, Option } from "effect"
import { isVouched, vouch } from "../domain/review/index.ts"
import { Store } from "../service/store/index.ts"
import { UnknownFile } from "./error.ts"
import type { BranchReading } from "./branches.ts"
import { blobOf } from "./patches.ts"

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

const blobIn = Effect.fn("Review.Vouch.blobIn")(function* (reading: BranchReading, file: string) {
  return yield* Option.match(blobOf(reading.patches, file), {
    onNone: () => new UnknownFile({ file, known: reading.patches.map((patch) => patch.path) }),
    onSome: Effect.succeed,
  })
})

export const toggle = Effect.fn("Review.Vouch.toggle")(function* (reading: BranchReading, file: string) {
  const store = yield* Store
  const patches = reading.patches
  const blob = yield* blobIn(reading, file)
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

export const progress = Effect.fn("Review.Vouch.progress")(function* (reading: BranchReading) {
  const store = yield* Store
  const current = yield* store.state(reading.worktree.path)
  const files = reading.patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((file) => isVouched(current.vouches, file.path, file.blob)).map((f) => f.path),
    parts: readParts(current.parts, files),
    total: reading.patches.length,
  } satisfies VouchReport
})
