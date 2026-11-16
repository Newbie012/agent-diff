import { Effect, Option } from "effect"
import type { Patch } from "../domain/patch/index.ts"
import { isVouched, pathOfPart, sameBlob, vouch, type Vouches } from "../domain/review/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { Store, type BranchState } from "../service/store/index.ts"
import { NotVouched, UnknownFile, VouchedVersionGone } from "./error.ts"
import { CONTEXT, patches as patchesIn, type Based, type BranchReading } from "./branches.ts"
import { blobOf, linesAround, shownAs, type ShownFile, type Showing } from "./patches.ts"
import { diffSince, readNow, type ReadNow } from "./carried.ts"
import { read } from "./order.ts"

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
  readonly layers?: ReadonlyArray<number>
}

export type ProgressReport = VouchReport & {
  readonly changed: ReadonlyArray<string>
  readonly since: ReadonlyArray<SinceReview>
}

export type Marking = {
  readonly blob?: string | undefined
  readonly at?: string | undefined
}

type Mark = { readonly key: string; readonly path: string; readonly blob: string; readonly at: string }

type Asked = { readonly mark: Mark; readonly deleted: boolean; readonly layers?: ReadonlyArray<number> | undefined }

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
  if (sameBlob(marked.blob, marked.onDisk)) yield* git.keep(worktree, [file])
  return marked.at ?? (yield* now)
})

export const fullBlob = Effect.fn("Review.Vouch.fullBlob")(function* (worktree: Worktree, blob: string) {
  const git = yield* Git
  return Option.getOrElse(yield* git.kept(worktree, blob), () => blob)
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
  const onDisk = yield* blobIn(reading, file)
  const asked = marking.blob ?? onDisk
  const at = yield* keepMarked(reading.worktree, file, { blob: asked, onDisk, at: marking.at })
  const blob = yield* fullBlob(reading.worktree, asked)
  yield* store.changeState(reading.worktree.path, (was) => stateAfter(was, file, blob, at))
  return yield* reportNow(reading)
})

const readingNow = Effect.fn("Review.Vouch.readingNow")(function* (reading: BranchReading) {
  const store = yield* Store
  const state = yield* store.state(reading.worktree.path)
  const held = yield* read(reading)
  return { state, marks: yield* readNow(reading.worktree, reading.patches, state, held.layers) }
})

export const reportNow = Effect.fn("Review.Vouch.reportNow")(function* (reading: BranchReading) {
  const { state, marks } = yield* readingNow(reading)
  return {
    vouched: reading.patches.filter((one) => isVouched(state.vouches, one.path, one.blob)).map((one) => one.path),
    parts: marks.parts,
    total: reading.patches.length,
  } satisfies VouchReport
})

const marksOf = (state: BranchState): ReadonlyArray<Mark> =>
  [
    ...Object.entries(state.vouches).map(([key, blob]) => ({ key, path: key, blob })),
    ...Object.entries(state.parts).map(([key, blob]) => ({ key, path: pathOfPart(key), blob })),
  ].map(({ key, path, blob }) => ({
    key,
    path,
    blob,
    at: state.vouchedAt[key] ?? "",
  }))

const newestFirst = (left: Mark, right: Mark): number => right.at.localeCompare(left.at)

const speaking = (marks: ReadonlyArray<Mark>, path: string): Option.Option<Mark> => {
  const own = marks.filter((mark) => mark.path === path)
  const whole = own.find((mark) => mark.key === path)
  return Option.fromNullishOr(whole ?? own.toSorted(newestFirst)[0])
}

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
    ...(asked.layers === undefined ? {} : { layers: asked.layers }),
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

const lapsedIn = (patches: ReadonlyArray<Patch>, marks: ReadonlyArray<Mark>, judged: ReadNow): ReadonlyArray<Asked> => {
  const lapsed = marks.filter((mark) => judged.lapsedKeys.includes(mark.key))
  return patches
    .filter((patch) => judged.changed.includes(patch.path))
    .flatMap((patch) =>
      Option.toArray(speaking(lapsed, patch.path)).map((mark) => ({
        mark,
        deleted: patch.status === "deleted",
        layers: judged.lapsedLayers.get(patch.path),
      })),
    )
}

const sinceReview = Effect.fn("Review.Vouch.sinceReview")(function* (
  reading: BranchReading,
  state: BranchState,
  judged: ReadNow,
) {
  const marks = marksOf(state)
  const gone = yield* goneSince(reading.worktree, marks, reading.patches)
  const asked = [
    ...lapsedIn(reading.patches, marks, judged),
    ...gone.map((mark) => ({ mark, deleted: true })),
  ]
  return yield* Effect.forEach(asked, (one) => reportSince(reading.worktree, one), { concurrency: 8 })
})

export const progress = Effect.fn("Review.Vouch.progress")(function* (reading: BranchReading) {
  const { state, marks } = yield* readingNow(reading)
  const files = reading.patches
  return {
    vouched: files.filter((file) => isVouched(state.vouches, file.path, file.blob)).map((f) => f.path),
    parts: marks.parts,
    changed: marks.changed,
    since: yield* sinceReview(reading, state, marks),
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
