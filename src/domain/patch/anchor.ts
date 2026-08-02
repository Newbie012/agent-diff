import { Option } from "effect"
import { lineOn, type Anchor, type Patch, type Range, type Row, type Side } from "./model.ts"

const sideOf = (rows: ReadonlyArray<Row>): Side =>
  rows.some((row) => Option.isSome(row.newLine)) ? "new" : "old"

const linesOn = (rows: ReadonlyArray<Row>, side: Side): ReadonlyArray<number> =>
  rows.flatMap((row) => Option.match(lineOn(row, side), { onNone: () => [], onSome: (n) => [n] }))

export const anchorFor = (patch: Patch, from: number, to: number): Option.Option<Anchor> => {
  const [low, high] = from <= to ? [from, to] : [to, from]
  const rows = patch.rows.slice(low, high + 1)
  if (rows.length === 0) return Option.none()

  const side = sideOf(rows)
  const lines = linesOn(rows, side)
  if (lines.length === 0) return Option.none()

  return Option.some({
    path: patch.path,
    blob: patch.blob,
    side,
    start: Math.min(...lines),
    end: Math.max(...lines),
    snippet: rows.map((row) => row.text).join("\n"),
  })
}

export const rowsForRange = (patch: Patch, range: Range): Option.Option<readonly [number, number]> => {
  const covered = patch.rows.filter((row) =>
    Option.match(lineOn(row, range.side), {
      onNone: () => false,
      onSome: (line) => line >= range.start && line <= range.end,
    }),
  )
  const first = covered[0]
  const last = covered.at(-1)
  if (first === undefined || last === undefined) return Option.none()
  return Option.some([first.index, last.index] as const)
}
