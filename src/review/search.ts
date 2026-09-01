import { Effect, Option } from "effect"
import {
  bandOf,
  declaresIn,
  ranked,
  tierOf,
  type Band,
  type Counted,
  type Place,
} from "../domain/search/index.ts"
import { Git } from "../service/git/index.ts"
import { readingOf, type BranchReading } from "./commands.ts"

export type Match = {
  readonly path: string
  readonly line: number
  readonly text: string
  readonly changed: boolean
  readonly declares: boolean
  readonly band: Band
  readonly around: ReadonlyArray<string>
}

export type Searched = {
  readonly matches: ReadonlyArray<Match>
  readonly counted: Counted
  readonly left: number
}

const HIT = /^(.+?):(\d+):(.*)$/

const AROUND = 2

const placeIn = (
  raw: string,
  term: string,
  reading: { readonly here: string; readonly changed: ReadonlySet<string> },
): Place | undefined => {
  const hit = HIT.exec(raw)
  if (hit === null) return undefined
  const path = hit[1] ?? ""
  const text = (hit[3] ?? "").trim()
  const tier = tierOf(path)
  return {
    path,
    line: Number(hit[2]),
    text,
    declares: tier === "data" ? false : declaresIn(text, term),
    band: bandOf(path, reading),
    tier,
  }
}

const matchOf = (place: Place): Match => ({
  path: place.path,
  line: place.line,
  text: place.text,
  changed: place.band !== "worktree",
  declares: place.declares,
  band: place.band,
  around: [],
})

export const searchIn = Effect.fn("Review.searchIn")(function* (
  reading: BranchReading,
  term: string,
  here = "",
) {
  const git = yield* Git
  const changed = new Set(reading.patches.map((patch) => patch.path))
  const raw = yield* git.grep(reading.worktree, term)
  const places = raw
    .split("\n")
    .filter((line) => line.length > 0)
    .flatMap((line) => {
      const place = placeIn(line, term, { here, changed })
      return place === undefined ? [] : [place]
    })
  const found = ranked(places)
  return {
    matches: found.places.map(matchOf),
    counted: found.counted,
    left: found.left,
  } satisfies Searched
})

export const aroundIn = Effect.fn("Review.aroundIn")(function* (
  reading: BranchReading,
  path: string,
  line: number,
) {
  const git = yield* Git
  const source = Option.getOrElse(
    yield* git.source(reading.worktree, path),
    (): ReadonlyArray<string> => [],
  )
  const from = Math.max(0, line - 1 - AROUND)
  const to = Math.min(source.length, line + AROUND)
  return source
    .slice(from, to)
    .map((text, at) => `${String(from + at + 1).padStart(5)} ${text}`)
})

export const searchBranch = Effect.fn("Review.searchBranch")(function* (
  repo: string,
  branch: string,
  term: string,
  here = "",
) {
  return yield* searchIn(yield* readingOf(repo, branch), term, here)
})
