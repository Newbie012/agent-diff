import type { Hunk, Patch, Row } from "./model.ts"

const known = new WeakMap<Patch, ReadonlySet<number>>()

const body = (row: Row): string => row.text.trimStart()

const addedByBody = (rows: ReadonlyArray<Row>): Map<string, Array<number>> => {
  const found = new Map<string, Array<number>>()
  for (const row of rows) {
    if (row.kind !== "added" || body(row).length === 0) continue
    const text = body(row)
    const at = found.get(text)
    if (at === undefined) found.set(text, [row.index])
    else at.push(row.index)
  }
  return found
}

const firstAbove = (free: Array<number>, floor: number): number | undefined => {
  while (free.length > 0 && (free[0] ?? -1) <= floor) free.shift()
  return free.shift()
}

const removedWithBody = (hunk: Hunk): ReadonlyArray<Row> =>
  hunk.rows.filter((row) => row.kind === "removed" && body(row).length > 0)

const pairsIn = (hunk: Hunk, paired: Set<number>): void => {
  const added = addedByBody(hunk.rows)
  let floor = -1
  for (const row of removedWithBody(hunk)) {
    const match = firstAbove(added.get(body(row)) ?? [], floor)
    if (match === undefined) continue
    floor = match
    paired.add(row.index)
    paired.add(match)
  }
}

export const reindentRows = (patch: Patch): ReadonlySet<number> => {
  const had = known.get(patch)
  if (had !== undefined) return had
  const paired = new Set<number>()
  for (const hunk of patch.hunks) pairsIn(hunk, paired)
  known.set(patch, paired)
  return paired
}
