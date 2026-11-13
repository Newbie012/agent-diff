import { Effect, Option } from "effect"
import { parsePatches, type Patch } from "../domain/patch/index.ts"
import { isVouched, vouch, type Vouches } from "../domain/review/index.ts"
import { Git, NO_CONTENT, type Worktree } from "../service/git/index.ts"
import { Store, type BranchState } from "../service/store/index.ts"
import { NotVouched, UnknownFile, VouchedVersionGone } from "./error.ts"
import { CONTEXT, patches as patchesIn, type Based, type BranchReading } from "./branches.ts"
import { blobOf, linesAround, shownAs, type ShownFile, type Showing } from "./patches.ts"

export type VouchReport = {
  readonly vouched: ReadonlyArray<string>
  readonly parts: ReadonlyArray<string>
  readonly total: number
}

export type SinceReview = {
  readonly path: string
  readonly at: string
  readonly reviewed: string
  readonly added: number
  readonly removed: number
  readonly places: number
  readonly kept: boolean
  readonly deleted?: true
}

export type ProgressReport = VouchReport & {
  readonly changed: ReadonlyArray<string>
  readonly since: ReadonlyArray<SinceReview>
}

export type Marking = {
  readonly blob?: string | undefined
  readonly at?: string | undefined
}

type Blobbed = { readonly path: string; readonly blob: string }

type Mark = { readonly key: string; readonly path: string; readonly blob: string; readonly at: string }

type Asked = { readonly mark: Mark; readonly deleted: boolean }

const pathOfMark = (mark: string): string => mark.split("@")[0] ?? ""

const changedSince = (
  marks: ReadonlyArray<Readonly<Record<string, string>>>,
  files: ReadonlyArray<Blobbed>,
): ReadonlyArray<string> => {
  const recorded = marks.flatMap((held) => Object.entries(held))
  const blobsOf = (file: Blobbed): ReadonlyArray<string> =>
    recorded.filter(([mark]) => pathOfMark(mark) === file.path).map(([, blob]) => blob)
  const lapsed = (file: Blobbed): boolean => {
    const blobs = blobsOf(file)
    return blobs.length > 0 && !blobs.includes(file.blob)
  }
  return files.filter(lapsed).map((file) => file.path)
}

export const readParts = (
  parts: Readonly<Record<string, string>>,
  files: ReadonlyArray<{ readonly path: string; readonly blob: string }>,
): ReadonlyArray<string> => {
  const blobs = new Map(files.map((file) => [file.path, file.blob]))
  return Object.entries(parts)
    .filter(([part, blob]) => blobs.get(pathOfMark(part)) === blob)
    .map(([part]) => part)
}

export const restamped = (
  stamps: Readonly<Record<string, string>>,
  before: Vouches,
  after: Vouches,
  at: string,
): Readonly<Record<string, string>> => {
  const still = Object.entries(stamps).filter(([key]) => key in after && after[key] === before[key])
  const fresh = Object.keys(after)
    .filter((key) => before[key] !== after[key])
    .map((key) => [key, at] as const)
  return Object.fromEntries([...still, ...fresh])
}

export const now = Effect.sync(() => new Date().toISOString())

export const keepMarked = Effect.fn("Review.Vouch.keepMarked")(function* (
  worktree: Worktree,
  file: string,
  marked: { readonly blob: string; readonly onDisk: string; readonly at: string | undefined },
) {
  const git = yield* Git
  if (marked.blob === marked.onDisk) yield* git.keep(worktree, [file])
  return marked.at ?? (yield* now)
})

const blobIn = Effect.fn("Review.Vouch.blobIn")(function* (reading: BranchReading, file: string) {
  return yield* Option.match(blobOf(reading.patches, file), {
    onNone: () => new UnknownFile({ file, known: reading.patches.map((patch) => patch.path) }),
    onSome: Effect.succeed,
  })
})

const stateAfter = (was: BranchState, file: string, blob: string, at: string): BranchState => {
  const vouches = vouch(was.vouches, file, blob)
  const before = { ...was.vouches, ...was.parts }
  const after = { ...vouches, ...was.parts }
  return { ...was, vouches, vouchedAt: restamped(was.vouchedAt, before, after, at) }
}

export const toggle = Effect.fn("Review.Vouch.toggle")(function* (
  reading: BranchReading,
  file: string,
  marking: Marking = {},
) {
  const store = yield* Store
  const patches = reading.patches
  const onDisk = yield* blobIn(reading, file)
  const blob = marking.blob ?? onDisk
  const at = yield* keepMarked(reading.worktree, file, { blob, onDisk, at: marking.at })
  const current = yield* store.state(reading.worktree.path)
  const next = vouch(current.vouches, file, blob)
  yield* store.changeState(reading.worktree.path, (was) => stateAfter(was, file, blob, at))
  const files = patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((one) => isVouched(next, one.path, one.blob)).map((one) => one.path),
    parts: readParts(current.parts, files),
    total: patches.length,
  } satisfies VouchReport
})

const marksOf = (state: BranchState): ReadonlyArray<Mark> =>
  [...Object.entries(state.vouches), ...Object.entries(state.parts)].map(([key, blob]) => ({
    key,
    path: pathOfMark(key),
    blob,
    at: state.vouchedAt[key] ?? "",
  }))

const newestFirst = (left: Mark, right: Mark): number => right.at.localeCompare(left.at)

const speaking = (marks: ReadonlyArray<Mark>, path: string, blob?: string): Option.Option<Mark> => {
  const own = marks.filter((mark) => mark.path === path && mark.blob !== blob)
  const whole = own.find((mark) => mark.key === path)
  return Option.fromNullishOr(whole ?? own.toSorted(newestFirst)[0])
}

const contentNow = Effect.fn("Review.Vouch.contentNow")(function* (worktree: Worktree, file: string) {
  const git = yield* Git
  const [found] = yield* git.keep(worktree, [file])
  if (found !== undefined) return found
  const [nothing] = yield* git.keep(worktree, [NO_CONTENT])
  return nothing ?? ""
})

const diffSince = Effect.fn("Review.Vouch.diffSince")(function* (
  worktree: Worktree,
  file: string,
  kept: string,
  context: number,
) {
  const git = yield* Git
  const raw = yield* git.between(worktree, kept, yield* contentNow(worktree, file), context)
  return Option.fromNullishOr(parsePatches(raw)[0])
})

const placesIn = (patch: Patch): number => patch.hunks.filter((hunk) => hunk.marker.length > 0).length

const counted = (patch: Option.Option<Patch>) =>
  Option.match(patch, {
    onNone: () => ({ added: 0, removed: 0, places: 0 }),
    onSome: (found) => ({ added: found.added, removed: found.removed, places: placesIn(found) }),
  })

const reportSince = Effect.fn("Review.Vouch.reportSince")(function* (worktree: Worktree, asked: Asked) {
  const git = yield* Git
  const { mark } = asked
  const told = {
    path: mark.path,
    at: mark.at,
    reviewed: mark.blob,
    ...(asked.deleted ? { deleted: true as const } : {}),
  }
  const kept = yield* git.kept(worktree, mark.blob)
  if (Option.isNone(kept)) return { ...told, added: 0, removed: 0, places: 0, kept: false }
  const patch = yield* diffSince(worktree, mark.path, kept.value, CONTEXT)
  return { ...told, ...counted(patch), kept: true } satisfies SinceReview
})

const isGone = Effect.fn("Review.Vouch.isGone")(function* (worktree: Worktree, path: string) {
  const git = yield* Git
  return Option.isNone(yield* git.source(worktree, path))
})

const goneSince = Effect.fn("Review.Vouch.goneSince")(function* (
  worktree: Worktree,
  marks: ReadonlyArray<Mark>,
  patches: ReadonlyArray<Patch>,
) {
  const inDiff = new Set(patches.map((patch) => patch.path))
  const left = [...new Set(marks.map((mark) => mark.path))].filter((path) => !inDiff.has(path))
  const gone = yield* Effect.filter(left, (path) => isGone(worktree, path))
  return gone.flatMap((path) => Option.toArray(speaking(marks, path)))
})

const lapsedIn = (
  patches: ReadonlyArray<Patch>,
  marks: ReadonlyArray<Mark>,
  changed: ReadonlyArray<string>,
): ReadonlyArray<Asked> =>
  patches
    .filter((patch) => changed.includes(patch.path))
    .flatMap((patch) =>
      Option.toArray(speaking(marks, patch.path, patch.blob)).map((mark) => ({
        mark,
        deleted: patch.status === "deleted",
      })),
    )

const sinceReview = Effect.fn("Review.Vouch.sinceReview")(function* (
  reading: BranchReading,
  state: BranchState,
  changed: ReadonlyArray<string>,
) {
  const marks = marksOf(state)
  const gone = yield* goneSince(reading.worktree, marks, reading.patches)
  const asked = [
    ...lapsedIn(reading.patches, marks, changed),
    ...gone.map((mark) => ({ mark, deleted: true })),
  ]
  return yield* Effect.forEach(asked, (one) => reportSince(reading.worktree, one), { concurrency: 8 })
})

export const progress = Effect.fn("Review.Vouch.progress")(function* (reading: BranchReading) {
  const store = yield* Store
  const current = yield* store.state(reading.worktree.path)
  const files = reading.patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  const changed = changedSince([current.vouches, current.parts], files)
  return {
    vouched: files.filter((file) => isVouched(current.vouches, file.path, file.blob)).map((f) => f.path),
    parts: readParts(current.parts, files),
    changed,
    since: yield* sinceReview(reading, current, changed),
    total: reading.patches.length,
  } satisfies ProgressReport
})

const unchanged = (file: string): Patch => ({
  path: file,
  previousPath: file,
  blob: "",
  headerLines: [],
  status: "changed",
  binary: false,
  hunks: [],
  rows: [],
  added: 0,
  removed: 0,
})

const markOf = Effect.fn("Review.Vouch.markOf")(function* (worktree: Worktree, file: string) {
  const store = yield* Store
  const git = yield* Git
  const state = yield* store.state(worktree.path)
  const mark = yield* Option.match(speaking(marksOf(state), file), {
    onNone: () => new NotVouched({ file }),
    onSome: Effect.succeed,
  })
  const kept = yield* git.kept(worktree, mark.blob)
  if (Option.isNone(kept)) return yield* new VouchedVersionGone({ file, blob: mark.blob })
  return kept.value
})

export const since = Effect.fn("Review.Vouch.since")(function* (
  based: Based,
  file: string,
  showing: Pick<Showing, "context">,
) {
  const git = yield* Git
  const { worktree } = based
  const kept = yield* markOf(worktree, file)
  const inDiff = (yield* patchesIn(worktree, CONTEXT, file)).find((patch) => patch.path === file)
  const found = yield* diffSince(worktree, file, kept, linesAround(showing.context))
  const lines = yield* git.source(worktree, file)
  const patch: Patch = {
    ...Option.getOrElse(found, () => unchanged(file)),
    path: file,
    previousPath: file,
    blob: inDiff?.blob ?? "",
    status: Option.isNone(lines) ? "deleted" : "changed",
  }
  return shownAs(patch, Option.getOrElse(lines, (): ReadonlyArray<string> => [])) satisfies ShownFile
})
