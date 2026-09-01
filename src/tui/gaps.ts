import { Option } from "effect"
import { REMAINDER_TITLE, type Span as Span2 } from "../domain/layers/index.ts"
import type { Hunk, Patch, Row } from "../domain/patch/index.ts"
import type { TuiState } from "./state.ts"

export const GAP_CHUNK = 10

export type Gap = {
  readonly index: number
  readonly hidden: number
  readonly row: number
}

export type Shown = {
  readonly patch: Patch
  readonly gaps: ReadonlyArray<Gap>
}

export type Reveal = {
  readonly file: string
  readonly gap: number
  readonly lines: number
}

type Span = { readonly lo: number; readonly hi: number }

type Build = {
  readonly base: Patch
  readonly full: Patch | undefined
  readonly spans: ReadonlyArray<Span>
  readonly reveals: ReadonlyArray<Reveal>
  readonly claim: Claim | undefined
}

type Claim = {
  readonly mine: (row: Row) => boolean
  readonly said: (row: Row) => string
  readonly holds: (hunk: Hunk) => boolean
}

type Made = {
  readonly rows: Array<Row>
  readonly hunks: Array<Hunk>
  readonly gaps: Array<Gap>
}

const sourceLength = (source: ReadonlyArray<string>): number =>
  source.at(-1)?.trim() === "" ? source.length - 1 : source.length

const markerText = (hidden: number): string => {
  const said = `⋯ ${hidden} ${hidden === 1 ? "line" : "lines"} hidden`
  return hidden <= GAP_CHUNK ? `${said} · l opens them` : `${said} · l opens ${GAP_CHUNK}, F opens all`
}

const lastNewLine = (patch: Patch): number => {
  const found = patch.rows.findLast((row) => Option.isSome(row.newLine))
  return found === undefined ? 0 : Option.getOrElse(found.newLine, () => 0)
}

const spansOf = (patch: Patch, total: number): ReadonlyArray<Span> => {
  const leading: Span = { lo: 1, hi: (patch.hunks[0]?.newStart ?? 1) - 1 }
  const between = patch.hunks
    .slice(1)
    .map((hunk): Span => ({ lo: hunk.newStart - hunk.skipped, hi: hunk.newStart - 1 }))
  const trailing: Span = { lo: lastNewLine(patch) + 1, hi: total }
  return [leading, ...between, trailing]
}

const linesFrom = (build: Build, from: number, to: number): ReadonlyArray<Row> =>
  build.full === undefined || to < from
    ? []
    : build.full.rows.filter((row) =>
        Option.match(row.newLine, {
          onNone: () => false,
          onSome: (line) => line >= from && line <= to,
        }),
      )

const push = (made: Made, row: Omit<Row, "index">): void => {
  made.rows.push({ ...row, index: made.rows.length })
}

const markGap = (made: Made, index: number, hidden: number): void => {
  made.gaps.push({ index, hidden, row: made.rows.length })
  push(made, {
    kind: "context",
    oldLine: Option.none(),
    newLine: Option.none(),
    text: markerText(hidden),
  })
}

const openOf = (build: Build, index: number, count: number): number => {
  if (build.full === undefined) return 0
  const asked = build.reveals.find((entry) => entry.gap === index)?.lines ?? 0
  return Math.min(count, Math.max(0, asked))
}

const countOf = (span: Span): number => Math.max(0, span.hi - span.lo + 1)

const openAbove = (made: Made, build: Build, index: number): number => {
  const span = build.spans[index]
  if (span === undefined) return 0
  const count = countOf(span)
  const open = openOf(build, index, count)
  const left = count - open
  if (left > 0) markGap(made, index, left)
  for (const row of linesFrom(build, span.hi - open + 1, span.hi)) push(made, row)
  return left
}

const openBelow = (made: Made, build: Build): void => {
  const index = build.base.hunks.length
  const span = build.spans[index]
  if (span === undefined) return
  const count = countOf(span)
  const open = openOf(build, index, count)
  for (const row of linesFrom(build, span.lo, span.lo + open - 1)) push(made, row)
  if (count - open > 0) markGap(made, index, count - open)
}

const elsewhereText = (lines: number, said: string): string =>
  `⋯ ${lines} changed ${lines === 1 ? "line" : "lines"} · ${said}`

const markElsewhere = (made: Made, lines: number, said: string): void => {
  push(made, {
    kind: "context",
    oldLine: Option.none(),
    newLine: Option.none(),
    text: elsewhereText(lines, said),
  })
}

type Run = { readonly lines: number; readonly said: string }

const flushed = (made: Made, run: Run | undefined): undefined => {
  if (run !== undefined) markElsewhere(made, run.lines, run.said)
  return undefined
}

const someRows = (made: Made, hunk: Hunk, claim: Claim): void => {
  let run: Run | undefined
  for (const row of hunk.rows) {
    if (row.kind === "context" || claim.mine(row)) {
      run = flushed(made, run)
      push(made, row)
      continue
    }
    run = { lines: (run?.lines ?? 0) + 1, said: run?.said ?? claim.said(row) }
  }
  flushed(made, run)
}

const changedIn = (hunk: Hunk): number =>
  hunk.rows.filter((row) => row.kind !== "context").length

const firstChanged = (hunk: Hunk): Row | undefined =>
  hunk.rows.find((row) => row.kind !== "context")

const makeRows = (build: Build): Made => {
  const made: Made = { rows: [], hunks: [], gaps: [] }
  for (const [index, hunk] of build.base.hunks.entries()) {
    const left = openAbove(made, build, index)
    const claim = build.claim
    const gone = firstChanged(hunk)
    if (claim !== undefined && gone !== undefined && !claim.holds(hunk)) {
      markElsewhere(made, changedIn(hunk), claim.said(gone))
      continue
    }
    const startRow = made.rows.length
    if (claim === undefined) for (const row of hunk.rows) push(made, row)
    else someRows(made, hunk, claim)
    made.hunks.push({
      ...hunk,
      startRow,
      rows: made.rows.slice(startRow),
      skipped: index === 0 ? 0 : left,
    })
  }
  openBelow(made, build)
  return made
}

const compose = (build: Build): Shown => {
  const made = makeRows(build)
  return { patch: { ...build.base, rows: made.rows, hunks: made.hunks }, gaps: made.gaps }
}

const cache = new WeakMap<Patch, Map<string, Shown>>()

const keyOf = (
  total: number,
  full: Patch | undefined,
  reveals: ReadonlyArray<Reveal>,
  spans: ReadonlyArray<Span2>,
): string =>
  [
    total,
    full === undefined ? 0 : full.rows.length,
    reveals.map((entry) => `${entry.gap}-${entry.lines}`).join(","),
    spans.map((span) => `${span.start}-${span.end}`).join(","),
  ].join(":")

const saidOf = (state: TuiState, at: number): string => {
  if (at === -1) return "no layer claims them"
  const layer = state.layers[at]
  if (layer === undefined || layer.title === REMAINDER_TITLE) return "no layer claims them"
  return `layer ${at + 1} explains them`
}

const lineOf = (row: Row): number | undefined =>
  Option.getOrUndefined(Option.orElse(row.newLine, () => row.oldLine))

const inSpans = (spans: ReadonlyArray<Span2>, path: string, line: number): boolean =>
  spans.some((span) => span.path === path && span.start <= line && span.end >= line)

const spansFor = (state: TuiState, path: string): ReadonlyArray<Span2> =>
  (state.layers[state.layerIndex]?.spans ?? []).filter((span) => span.path === path)

const claimOf = (state: TuiState, base: Patch): Claim | undefined => {
  if (state.rail !== "layers" || state.layers.length === 0) return undefined
  if (state.layers[state.layerIndex] === undefined) return undefined
  const mineSpans = spansFor(state, base.path)
  const mine = (row: Row): boolean => {
    const line = lineOf(row)
    return line !== undefined && inSpans(mineSpans, base.path, line)
  }
  const said = (row: Row): string => {
    const line = lineOf(row)
    if (line === undefined) return "no layer claims them"
    return saidOf(
      state,
      state.layers.findIndex((one) => inSpans(one.spans, base.path, line)),
    )
  }
  const holds = (hunk: Hunk): boolean => hunk.rows.some((row) => row.kind !== "context" && mine(row))
  return base.hunks.every(holds) && base.hunks.every((hunk) => hunk.rows.every((row) => row.kind === "context" || mine(row)))
    ? undefined
    : { mine, said, holds }
}

export const shownOf = (state: TuiState): Shown | undefined => {
  const base = state.patches[state.patchIndex]
  if (base === undefined) return undefined
  const full = state.full.find((patch) => patch.path === base.path)
  const total = sourceLength(state.source)
  const reveals = state.revealed.filter((entry) => entry.file === base.path)
  const claim = claimOf(state, base)
  const key = keyOf(total, full, reveals, claim === undefined ? [] : spansFor(state, base.path))
  const known = cache.get(base)
  const found = known?.get(key)
  if (found !== undefined) return found
  const made = compose({ base, full, spans: spansOf(base, total), reveals, claim })
  const map = known ?? new Map<string, Shown>()
  map.set(key, made)
  cache.set(base, map)
  return made
}

export const gapAtRow = (state: TuiState, row: number): Gap | undefined =>
  shownOf(state)?.gaps.find((gap) => gap.row === row)

export const gapNumbered = (state: TuiState, index: number): Gap | undefined =>
  shownOf(state)?.gaps.find((gap) => gap.index === index)

export const gapRowSet = (shown: Shown): ReadonlySet<number> =>
  new Set(shown.gaps.map((gap) => gap.row))
