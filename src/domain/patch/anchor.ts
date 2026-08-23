import { Option } from "effect"
import { lineOn, type Anchor, type Patch, type Range, type Row, type Side } from "./model.ts"

const sideOf = (rows: ReadonlyArray<Row>): Side =>
  rows.some((row) => Option.isSome(row.newLine)) ? "new" : "old"

const linesOn = (rows: ReadonlyArray<Row>, side: Side): ReadonlyArray<number> =>
  rows.flatMap((row) => Option.match(lineOn(row, side), { onNone: () => [], onSome: (n) => [n] }))

export const anchorFor = (
  patch: Patch,
  from: number,
  to: number,
  wanted?: Side,
): Option.Option<Anchor> => {
  const [low, high] = from <= to ? [from, to] : [to, from]
  const rows = patch.rows.slice(low, high + 1)
  if (rows.length === 0) return Option.none()

  const side = wanted ?? sideOf(rows)
  const onSide = rows.filter((row) => Option.isSome(lineOn(row, side)))
  const lines = linesOn(onSide, side)
  if (lines.length === 0) return Option.none()

  return Option.some({
    path: patch.path,
    blob: patch.blob,
    side,
    start: Math.min(...lines),
    end: Math.max(...lines),
    snippet: onSide.map((row) => row.text).join("\n"),
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

const sideLines = (
  patch: Patch,
  side: Side,
): ReadonlyArray<{ readonly line: number; readonly text: string }> =>
  patch.rows.flatMap((row) =>
    Option.match(lineOn(row, side), {
      onNone: () => [],
      onSome: (line) => [{ line, text: row.text }],
    }),
  )

const runsAt = (
  lines: ReadonlyArray<{ readonly line: number; readonly text: string }>,
  wanted: ReadonlyArray<string>,
  at: number,
): boolean =>
  wanted.every((text, step) => {
    const here = lines[at + step]
    return here !== undefined && here.text === text && here.line === (lines[at]?.line ?? 0) + step
  })

const nearestRun = (
  lines: ReadonlyArray<{ readonly line: number; readonly text: string }>,
  said: ReadonlyArray<string>,
  near: number,
): number | undefined =>
  lines
    .flatMap((here, at) => (runsAt(lines, said, at) ? [here.line] : []))
    .toSorted((one, other) => Math.abs(one - near) - Math.abs(other - near))[0]

const SHORTEST_NEAR = 8

const PER_EDIT = 4

const edits = (one: string, other: string): number => {
  let row = Array.from({ length: other.length + 1 }, (_, at) => at)
  for (let step = 1; step <= one.length; step += 1) {
    const next = [step]
    for (let at = 1; at <= other.length; at += 1) {
      const swap = (row[at - 1] ?? 0) + (one[step - 1] === other[at - 1] ? 0 : 1)
      next.push(Math.min(swap, (row[at] ?? 0) + 1, (next[at - 1] ?? 0) + 1))
    }
    row = next
  }
  return row[other.length] ?? 0
}

const isNear = (one: string, other: string): boolean => {
  const room = Math.max(one.trim().length, other.trim().length)
  return room >= SHORTEST_NEAR && edits(one, other) <= Math.floor(room / PER_EDIT)
}

const nearestLike = (
  lines: ReadonlyArray<{ readonly line: number; readonly text: string }>,
  said: string,
  near: number,
): number | undefined =>
  lines
    .filter((here) => isNear(here.text, said))
    .toSorted((one, other) => Math.abs(one.line - near) - Math.abs(other.line - near))[0]?.line

export const foundAgain = (
  patch: Patch,
  wanted: { readonly side: Side; readonly start: number; readonly snippet: string },
): Option.Option<Range> => {
  const said = wanted.snippet.split("\n")
  if (said.every((text) => text.trim().length === 0)) return Option.none()
  const lines = sideLines(patch, wanted.side)
  const whole = nearestRun(lines, said, wanted.start)
  if (whole !== undefined) {
    return Option.some({ side: wanted.side, start: whole, end: whole + said.length - 1 })
  }
  const first = said[0] ?? ""
  if (first.trim().length === 0) return Option.none()
  const opening =
    said.length === 1 ? undefined : nearestRun(lines, [first], wanted.start)
  const alike = opening ?? nearestLike(lines, first, wanted.start)
  if (alike === undefined) return Option.none()
  return Option.some({ side: wanted.side, start: alike, end: alike })
}
