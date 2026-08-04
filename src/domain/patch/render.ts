import { Option } from "effect"
import { lineOn, type Patch, type Row, type RowKind } from "./model.ts"

const SIGNS: Record<RowKind, string> = { context: " ", added: "+", removed: "-" }

export type RenderedHunk = {
  readonly startRow: number
  readonly scope: string
}

export type Rendered = {
  readonly text: string
  readonly hunks: ReadonlyArray<RenderedHunk>
}

export const renderPatch = (patch: Patch): Rendered => {
  const lines: Array<string> = [...patch.headerLines]
  for (const hunk of patch.hunks) {
    lines.push(hunk.marker)
    for (const row of hunk.rows) lines.push(`${SIGNS[row.kind]}${row.text}`)
  }
  return {
    text: lines.join("\n"),
    hunks: patch.hunks.map((hunk) => ({ startRow: hunk.startRow, scope: hunk.scope })),
  }
}

export const scopeAbove = (rendered: Rendered, topRow: number): string => {
  const hunk = rendered.hunks.findLast((candidate) => candidate.startRow < topRow)
  return hunk === undefined ? "" : hunk.scope
}

const countOn = (rows: ReadonlyArray<Row>, side: "old" | "new"): number =>
  rows.filter((row) => Option.isSome(lineOn(row, side))).length

const firstOn = (rows: ReadonlyArray<Row>, side: "old" | "new"): number => {
  const found = rows.find((row) => Option.isSome(lineOn(row, side)))
  return found === undefined ? 1 : Option.getOrElse(lineOn(found, side), () => 1)
}

export const renderWindow = (patch: Patch, from: number, count: number): string => {
  const rows = patch.rows.slice(from, from + count)
  if (rows.length === 0) return patch.headerLines.join("\n")
  const marker = `@@ -${firstOn(rows, "old")},${countOn(rows, "old")} +${firstOn(rows, "new")},${countOn(rows, "new")} @@`
  return [...patch.headerLines, marker, ...rows.map((row) => `${SIGNS[row.kind]}${row.text}`)].join(
    "\n",
  )
}
