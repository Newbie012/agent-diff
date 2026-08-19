import type { Option } from "effect"

export const WHOLE_FILE = 100_000

export type Side = "old" | "new"

export type RowKind = "context" | "added" | "removed"

export type Row = {
  readonly index: number
  readonly kind: RowKind
  readonly oldLine: Option.Option<number>
  readonly newLine: Option.Option<number>
  readonly text: string
}

export type Hunk = {
  readonly marker: string
  readonly scope: string
  readonly startRow: number
  readonly newStart: number
  readonly rows: ReadonlyArray<Row>
  readonly skipped: number
}

export type Patch = {
  readonly path: string
  readonly previousPath: string
  readonly blob: string
  readonly headerLines: ReadonlyArray<string>
  readonly hunks: ReadonlyArray<Hunk>
  readonly rows: ReadonlyArray<Row>
  readonly added: number
  readonly removed: number
}

export type Range = {
  readonly side: Side
  readonly start: number
  readonly end: number
}

export type Anchor = Range & {
  readonly path: string
  readonly blob: string
  readonly snippet: string
}

export const lineOn = (row: Row, side: Side): Option.Option<number> =>
  side === "new" ? row.newLine : row.oldLine
