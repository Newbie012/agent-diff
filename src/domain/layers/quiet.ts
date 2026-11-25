import { Option } from "effect"
import type { Hunk, Patch, Row, RowKind } from "../patch/index.ts"
import type { Span } from "./model.ts"

export const FOLDS_FROM = 8

const lineOf = (row: Row): number | undefined =>
  Option.getOrUndefined(Option.orElse(row.newLine, () => row.oldLine))

export const quietRows = (hunk: Hunk, mine: (row: Row) => boolean): ReadonlySet<Row> => {
  const quiet = new Set<Row>()
  if (!hunk.rows.some((row) => row.kind !== "context" && mine(row))) return quiet
  let run: Array<Row> = []
  const flush = (): void => {
    if (run.length < FOLDS_FROM) for (const row of run) quiet.add(row)
    run = []
  }
  for (const row of hunk.rows) {
    if (row.kind === "context" || mine(row)) flush()
    else run.push(row)
  }
  flush()
  return quiet
}

export const quietKey = (kind: RowKind | "note", line: number): string => `${kind}:${line}`

const holds = (spans: ReadonlyArray<Span>, path: string, row: Row): boolean => {
  const line = lineOf(row)
  return line !== undefined && spans.some((span) => span.path === path && span.start <= line && span.end >= line)
}

const quietFor = (patch: Patch, spans: ReadonlyArray<Span>): ReadonlyArray<Row> =>
  patch.hunks.flatMap((hunk) => [...quietRows(hunk, (row) => holds(spans, patch.path, row))])

export const quietLayers = (
  patch: Patch,
  layers: ReadonlyArray<ReadonlyArray<Span>>,
): ReadonlyMap<string, ReadonlyArray<number>> => {
  const found = new Map<string, Array<number>>()
  for (const [at, spans] of layers.entries()) {
    for (const row of quietFor(patch, spans)) {
      const line = lineOf(row)
      if (line === undefined) continue
      const key = quietKey(row.kind, line)
      found.set(key, [...(found.get(key) ?? []), at + 1])
    }
  }
  return found
}
