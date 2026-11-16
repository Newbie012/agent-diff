import { Effect, Option } from "effect"
import { parsePatches, type Patch } from "../domain/patch/index.ts"
import {
  EVERY_LINE,
  leavesUntouched,
  NO_CHANGE,
  partOf,
  pathOfPart,
  runsOfPart,
  sameBlob,
  type Change,
  type Run,
} from "../domain/review/index.ts"
import { Git, NO_CONTENT, type Worktree } from "../service/git/index.ts"
import type { BranchState } from "../service/store/index.ts"

export type Claimant = { readonly spans: ReadonlyArray<{ readonly path: string; readonly start: number; readonly end: number }> }

export type ReadNow = {
  readonly parts: ReadonlyArray<string>
  readonly changed: ReadonlyArray<string>
  readonly lapsedKeys: ReadonlyArray<string>
  readonly lapsedLayers: ReadonlyMap<string, ReadonlyArray<number>>
}

type Shared = { readonly layer: number; readonly part: string; readonly runs: ReadonlyArray<Run> }

type FileNow = {
  readonly path: string
  readonly blob: string
  readonly deleted: boolean
  readonly whole: string | undefined
  readonly parts: ReadonlyArray<readonly [string, string]>
  readonly shared: ReadonlyArray<Shared>
}

export const contentNow = Effect.fn("Review.Carried.contentNow")(function* (worktree: Worktree, file: string) {
  const git = yield* Git
  const [found] = yield* git.keep(worktree, [file])
  if (found !== undefined) return found
  const [nothing] = yield* git.keep(worktree, [NO_CONTENT])
  return nothing ?? ""
})

export const diffSince = Effect.fn("Review.Carried.diffSince")(function* (
  worktree: Worktree,
  file: string,
  kept: string,
  context: number,
) {
  const git = yield* Git
  const raw = yield* git.between(worktree, kept, yield* contentNow(worktree, file), context)
  return Option.fromNullishOr(parsePatches(raw)[0])
})

const REMEMBERED = 512

const remembered = new Map<string, Change>()

const remember = (key: string, change: Change): Change => {
  if (change.kind === "all") return change
  if (remembered.size >= REMEMBERED) remembered.clear()
  remembered.set(key, change)
  return change
}

const readChange = Effect.fn("Review.Carried.readChange")(function* (
  worktree: Worktree,
  file: FileNow,
  blob: string,
) {
  const git = yield* Git
  const kept = yield* git.kept(worktree, blob)
  if (Option.isNone(kept)) return EVERY_LINE
  const diff = yield* diffSince(worktree, file.path, kept.value, 0)
  return Option.match(diff, {
    onNone: (): Change => NO_CHANGE,
    onSome: (found): Change => ({ kind: "lines", diff: found }),
  })
})

const changeSince = Effect.fn("Review.Carried.changeSince")(function* (
  worktree: Worktree,
  file: FileNow,
  blob: string,
) {
  if (sameBlob(blob, file.blob)) return NO_CHANGE
  if (file.deleted) return EVERY_LINE
  const key = `${worktree.path}\0${file.path}\0${blob}\0${file.blob}`
  const known = remembered.get(key)
  if (known !== undefined) return known
  return remember(key, yield* readChange(worktree, file, blob))
})

const sharedParts = (layers: ReadonlyArray<Claimant>, path: string): ReadonlyArray<Shared> => {
  const holding = layers
    .map((layer, at) => ({ layer: at + 1, runs: layer.spans.filter((span) => span.path === path) }))
    .filter((held) => held.runs.length > 0)
  if (holding.length < 2) return []
  return holding.map((held) => ({ layer: held.layer, part: partOf(path, held.runs), runs: held.runs }))
}

const filesNow = (
  patches: ReadonlyArray<Patch>,
  state: BranchState,
  layers: ReadonlyArray<Claimant>,
): ReadonlyArray<FileNow> => {
  const partMarks = Object.entries(state.parts)
  return patches.map((patch) => ({
    path: patch.path,
    blob: patch.blob,
    deleted: patch.status === "deleted",
    whole: state.vouches[patch.path],
    parts: partMarks.filter(([part]) => pathOfPart(part) === patch.path),
    shared: sharedParts(layers, patch.path),
  }))
}

const marksOn = (file: FileNow): ReadonlyArray<string> => [
  ...(file.whole === undefined ? [] : [file.whole]),
  ...file.parts.map(([, blob]) => blob),
]

type Judged = {
  readonly parts: ReadonlyArray<string>
  readonly lapsedKeys: ReadonlyArray<string>
  readonly lapsedLayers: ReadonlyArray<number>
}

const judged = (file: FileNow, changes: ReadonlyMap<string, Change>): Judged => {
  const changeOf = (blob: string): Change => changes.get(blob) ?? EVERY_LINE
  const ownRead = file.parts.filter(([part, blob]) => leavesUntouched(changeOf(blob), runsOfPart(part)))
  const ownLapsed = file.parts.filter(([part]) => !ownRead.some(([read]) => read === part))
  const wholeChange = file.whole === undefined ? undefined : changeOf(file.whole)
  const wholeLapsed = wholeChange !== undefined && wholeChange.kind !== "none"
  const carried = file.shared.filter(
    (shared) => wholeChange !== undefined && wholeLapsed && leavesUntouched(wholeChange, shared.runs),
  )
  const parts = [...new Set([...ownRead.map(([part]) => part), ...carried.map((shared) => shared.part)])]
  const marked = (shared: Shared): boolean =>
    file.whole !== undefined || file.parts.some(([part]) => part === shared.part)
  if (wholeChange?.kind === "none") return { parts, lapsedKeys: [], lapsedLayers: [] }
  return {
    parts,
    lapsedKeys: [...(wholeLapsed ? [file.path] : []), ...ownLapsed.map(([part]) => part)],
    lapsedLayers: file.shared
      .filter((shared) => marked(shared) && !parts.includes(shared.part))
      .map((shared) => shared.layer),
  }
}

const changesOf = Effect.fn("Review.Carried.changesOf")(function* (worktree: Worktree, file: FileNow) {
  const blobs = [...new Set(marksOn(file))]
  const found = yield* Effect.forEach(blobs, (blob) => changeSince(worktree, file, blob))
  return new Map(blobs.map((blob, at) => [blob, found[at] ?? EVERY_LINE] as const))
})

export const readNow = Effect.fn("Review.Carried.readNow")(function* (
  worktree: Worktree,
  patches: ReadonlyArray<Patch>,
  state: BranchState,
  layers: ReadonlyArray<Claimant>,
) {
  const files = filesNow(patches, state, layers).filter((file) => marksOn(file).length > 0)
  const changes = yield* Effect.forEach(files, (file) => changesOf(worktree, file), { concurrency: 8 })
  const verdicts = files.map((file, at) => [file, judged(file, changes[at] ?? new Map())] as const)
  return {
    parts: verdicts.flatMap(([, verdict]) => verdict.parts),
    changed: verdicts.filter(([, verdict]) => verdict.lapsedKeys.length > 0).map(([file]) => file.path),
    lapsedKeys: verdicts.flatMap(([, verdict]) => verdict.lapsedKeys),
    lapsedLayers: new Map(
      verdicts
        .filter(([file]) => file.shared.length > 0)
        .map(([file, verdict]) => [file.path, verdict.lapsedLayers] as const),
    ),
  } satisfies ReadNow
})
