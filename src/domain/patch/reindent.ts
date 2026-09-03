import type { Hunk, Row } from "./model.ts"

const LCS_ROOM = 1_000_000

type Block = { readonly removed: Array<Row>; readonly added: Array<Row> }

const body = (row: Row): string => row.text.trimStart()

const isBlock = (entry: Block | Row): entry is Block => !("kind" in entry)

const openBlock = (): Block => ({ removed: [], added: [] })

const sideOf = (block: Block, row: Row): Array<Row> => (row.kind === "removed" ? block.removed : block.added)

const blocksOf = (rows: ReadonlyArray<Row>): ReadonlyArray<Block | Row> => {
  const out: Array<Block | Row> = []
  for (const row of rows) {
    if (row.kind === "context") {
      out.push(row)
      continue
    }
    const last = out.at(-1)
    const block = last !== undefined && isBlock(last) ? last : openBlock()
    if (block !== last) out.push(block)
    sideOf(block, row).push(row)
  }
  return out
}

const at = (table: ReadonlyArray<Uint32Array>, i: number, j: number): number => table[i]?.[j] ?? 0

const fillRow = (table: ReadonlyArray<Uint32Array>, old: string, now: ReadonlyArray<string>, i: number): void => {
  const row = table[i]
  if (row === undefined) return
  for (let j = now.length - 1; j >= 0; j--) {
    row[j] = old === now[j] ? at(table, i + 1, j + 1) + 1 : Math.max(at(table, i + 1, j), at(table, i, j + 1))
  }
}

const lcsTable = (old: ReadonlyArray<string>, now: ReadonlyArray<string>): ReadonlyArray<Uint32Array> => {
  const table = Array.from({ length: old.length + 1 }, () => new Uint32Array(now.length + 1))
  for (let i = old.length - 1; i >= 0; i--) fillRow(table, old[i] ?? "", now, i)
  return table
}

const joined = (removed: Row, added: Row): Row => ({
  index: 0,
  kind: "context",
  oldLine: removed.oldLine,
  newLine: added.newLine,
  text: added.text,
})

type Step = { readonly row: Row; readonly old: number; readonly now: number }

const stepAt = (block: Block, table: ReadonlyArray<Uint32Array>, i: number, j: number): Step | undefined => {
  const removed = block.removed[i]
  const added = block.added[j]
  if (removed === undefined || added === undefined) return undefined
  if (body(removed) === body(added)) return { row: joined(removed, added), old: 1, now: 1 }
  if (at(table, i + 1, j) >= at(table, i, j + 1)) return { row: removed, old: 1, now: 0 }
  return { row: added, old: 0, now: 1 }
}

const walked = (block: Block, table: ReadonlyArray<Uint32Array>): ReadonlyArray<Row> => {
  const out: Array<Row> = []
  let i = 0
  let j = 0
  for (let step = stepAt(block, table, i, j); step !== undefined; step = stepAt(block, table, i, j)) {
    out.push(step.row)
    i += step.old
    j += step.now
  }
  return [...out, ...block.removed.slice(i), ...block.added.slice(j)]
}

const canFold = (block: Block): boolean =>
  block.removed.length > 0 && block.added.length > 0 && block.removed.length * block.added.length <= LCS_ROOM

const folded = (block: Block): ReadonlyArray<Row> => {
  if (!canFold(block)) return [...block.removed, ...block.added]
  const table = lcsTable(block.removed.map(body), block.added.map(body))
  if (at(table, 0, 0) === 0) return [...block.removed, ...block.added]
  return walked(block, table)
}

const rowsOf = (hunk: Hunk): ReadonlyArray<Row> =>
  blocksOf(hunk.rows).flatMap((entry) => (isBlock(entry) ? folded(entry) : [entry]))

const reindexed = (rows: ReadonlyArray<Row>, startRow: number): ReadonlyArray<Row> =>
  rows.map((row, offset) => Object.assign({}, row, { index: startRow + offset }))

export type Folded = {
  readonly hunks: ReadonlyArray<Hunk>
  readonly rows: ReadonlyArray<Row>
  readonly added: number
  readonly removed: number
}

export const foldReindents = (hunks: ReadonlyArray<Hunk>): Folded => {
  const rows: Array<Row> = []
  const kept: Array<Hunk> = []
  for (const hunk of hunks) {
    const startRow = rows.length
    const own = reindexed(rowsOf(hunk), startRow)
    rows.push(...own)
    kept.push({ ...hunk, startRow, rows: own })
  }
  return {
    hunks: kept,
    rows,
    added: rows.filter((row) => row.kind === "added").length,
    removed: rows.filter((row) => row.kind === "removed").length,
  }
}
