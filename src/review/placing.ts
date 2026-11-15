import { Effect, Option } from "effect"
import {
  followed,
  foundInScope,
  isNear,
  parsePatches,
  WHOLE_FILE,
  type Patch,
  type Side,
} from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"

export type Anchored = {
  readonly path: string
  readonly side: Side
  readonly start: number
  readonly end: number
  readonly snippet: string
  readonly blob: string
  readonly version?: string | undefined
}

export type Placed = {
  readonly start: number
  readonly end: number
  readonly placed: boolean
  readonly outdated: boolean
  readonly reworded: boolean
}

type Now = {
  readonly version: Option.Option<string>
  readonly lines: ReadonlyArray<string>
}

const keptOf = (found: Option.Option<ReadonlyArray<string>>): ReadonlyArray<string> =>
  Option.getOrElse(found, (): ReadonlyArray<string> => [])

const baseOf = (worktree: Worktree): string => (worktree.base.length > 0 ? worktree.base : "HEAD")

const nowOnNew = Effect.fn("Review.Placing.nowOnNew")(function* (worktree: Worktree, patch: Patch) {
  const git = yield* Git
  if (patch.status === "deleted") return { version: Option.none(), lines: [] } satisfies Now
  const lines = keptOf(yield* git.source(worktree, patch.path))
  const [version] = yield* git.keep(worktree, [patch.path])
  return { version: Option.fromNullishOr(version), lines } satisfies Now
})

const nowOnOld = Effect.fn("Review.Placing.nowOnOld")(function* (worktree: Worktree, patch: Patch) {
  const git = yield* Git
  if (patch.status === "added") return { version: Option.none(), lines: [] } satisfies Now
  const named = `${baseOf(worktree)}:${patch.previousPath}`
  const version = yield* git.kept(worktree, named)
  const lines = Option.isNone(version) ? [] : keptOf(yield* git.blob(worktree, patch.previousPath))
  return { version, lines } satisfies Now
})

const writtenName = (anchor: Anchored): string =>
  anchor.version ?? (anchor.side === "new" ? anchor.blob : "")

const unplaced = (anchor: Anchored): Placed => ({
  start: anchor.start,
  end: anchor.end,
  placed: false,
  outdated: false,
  reworded: false,
})

const rewordedAt = (anchor: Anchored, lines: ReadonlyArray<string>, start: number, end: number): boolean => {
  const first = anchor.snippet.split("\n")[0] ?? ""
  if (first.trim().length === 0) return false
  return lines.slice(start - 1, end).some((line) => line === first || isNear(line, first))
}

const standing = (anchor: Anchored): Placed => ({ ...unplaced(anchor), placed: true })

const searched = (anchor: Anchored, now: Now): Placed =>
  Option.match(foundInScope(now.lines, anchor), {
    onNone: () => unplaced(anchor),
    onSome: (range) => ({
      start: range.start,
      end: range.end,
      placed: true,
      outdated: true,
      reworded: rewordedAt(anchor, now.lines, range.start, range.end),
    }),
  })

const keyOf = (anchor: Anchored): string => `${anchor.side}\u0000${anchor.path}`

const pairOf = (from: string, to: string): string => `${from}..${to}`

const unique = (keys: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(keys)]

type Read = {
  readonly nows: ReadonlyMap<string, Now>
  readonly written: ReadonlyMap<string, Option.Option<string>>
  readonly diffs: ReadonlyMap<string, Patch | undefined>
}

const nowFor = (anchor: Anchored, read: Read): Option.Option<Now> => {
  const now = read.nows.get(keyOf(anchor))
  return now === undefined || Option.isNone(now.version) ? Option.none() : Option.some(now)
}

const placedWithout = (anchor: Anchored, now: Now): Placed =>
  anchor.snippet.trim().length === 0 ? standing(anchor) : searched(anchor, now)

const placedThrough = (anchor: Anchored, now: Now, diff: Patch): Placed => {
  const moved = followed(diff, anchor, now.lines.length)
  return { ...moved, placed: true, reworded: moved.outdated && rewordedAt(anchor, now.lines, moved.start, moved.end) }
}

const placedFrom = (anchor: Anchored, now: Now, was: string, read: Read): Placed => {
  const version = Option.getOrElse(now.version, () => was)
  if (was === version) return standing(anchor)
  const diff = read.diffs.get(pairOf(was, version))
  return diff === undefined ? standing(anchor) : placedThrough(anchor, now, diff)
}

const placeOne = (anchor: Anchored, read: Read): Placed => {
  if (anchor.start === WHOLE_FILE) return unplaced(anchor)
  return Option.match(nowFor(anchor, read), {
    onNone: () => unplaced(anchor),
    onSome: (now) =>
      Option.match(read.written.get(writtenName(anchor)) ?? Option.none(), {
        onNone: () => placedWithout(anchor, now),
        onSome: (was) => placedFrom(anchor, now, was, read),
      }),
  })
}

const nowsOf = (worktree: Worktree, byPath: ReadonlyMap<string, Patch>, shown: ReadonlyArray<Anchored>) => {
  const nowOf = (anchor: Anchored, patch: Patch) => {
    const reading = anchor.side === "new" ? nowOnNew(worktree, patch) : nowOnOld(worktree, patch)
    return Effect.map(reading, (now) => [keyOf(anchor), now] as const)
  }
  const first = [...new Map(shown.map((anchor) => [keyOf(anchor), anchor])).values()]
  const reads = first.flatMap((anchor) => {
    const patch = byPath.get(anchor.path)
    return patch === undefined ? [] : [nowOf(anchor, patch)]
  })
  return Effect.map(Effect.all(reads, { concurrency: 8 }), (found) => new Map(found))
}

const writtenOf = Effect.fn("Review.Placing.writtenOf")(function* (worktree: Worktree, shown: ReadonlyArray<Anchored>) {
  const git = yield* Git
  const names = unique(shown.map(writtenName).filter((name) => name.length > 0))
  const keptOne = (name: string) => Effect.map(git.kept(worktree, name), (found) => [name, found] as const)
  return new Map(yield* Effect.forEach(names, keptOne, { concurrency: 8 }))
})

const pairsOf = (shown: ReadonlyArray<Anchored>, read: Omit<Read, "diffs">) =>
  shown.flatMap((anchor) => {
    const was = read.written.get(writtenName(anchor)) ?? Option.none()
    const now = read.nows.get(keyOf(anchor))?.version ?? Option.none()
    if (Option.isNone(was) || Option.isNone(now) || was.value === now.value) return []
    return [[was.value, now.value] as const]
  })

const diffsOf = Effect.fn("Review.Placing.diffsOf")(function* (
  worktree: Worktree,
  pairs: ReadonlyArray<readonly [string, string]>,
) {
  const git = yield* Git
  const between = ([from, to]: readonly [string, string]) =>
    Effect.map(git.between(worktree, from, to, 0), (raw) => [pairOf(from, to), parsePatches(raw)[0]] as const)
  const wanted = [...new Map(pairs.map((pair) => [pairOf(pair[0], pair[1]), pair])).values()]
  return new Map(yield* Effect.forEach(wanted, between, { concurrency: 8 }))
})

export const placedAll = Effect.fn("Review.Placing.placedAll")(function* (
  worktree: Worktree,
  patches: ReadonlyArray<Patch>,
  anchors: ReadonlyArray<Anchored>,
) {
  const byPath = new Map(patches.map((patch) => [patch.path, patch]))
  const shown = anchors.filter((anchor) => byPath.has(anchor.path) && anchor.start !== WHOLE_FILE)
  const nows = yield* nowsOf(worktree, byPath, shown)
  const written = yield* writtenOf(worktree, shown)
  const diffs = yield* diffsOf(worktree, pairsOf(shown, { nows, written }))
  const read: Read = { nows, written, diffs }
  return anchors.map((anchor) => (byPath.has(anchor.path) ? placeOne(anchor, read) : unplaced(anchor)))
})

export const versionOf = Effect.fn("Review.Placing.versionOf")(function* (
  worktree: Worktree,
  patch: Patch,
  side: Side,
) {
  const now = side === "new" ? yield* nowOnNew(worktree, patch) : yield* nowOnOld(worktree, patch)
  return now.version
})
