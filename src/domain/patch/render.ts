import type { Patch, RowKind } from "./model.ts"

const SIGNS: Record<RowKind, string> = { context: " ", added: "+", removed: "-" }

export type Rendered = {
  readonly text: string
  readonly lineOfRow: ReadonlyArray<number>
}

export const renderPatch = (patch: Patch): Rendered => {
  const lines: Array<string> = [...patch.headerLines]
  const lineOfRow: Array<number> = []
  for (const hunk of patch.hunks) {
    lines.push(hunk.marker)
    for (const row of hunk.rows) {
      lineOfRow[row.index] = lines.length
      lines.push(`${SIGNS[row.kind]}${row.text}`)
    }
  }
  return { text: lines.join("\n"), lineOfRow }
}
