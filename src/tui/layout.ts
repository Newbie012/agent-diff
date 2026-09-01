import { WHOLE_FILE } from "../domain/patch/index.ts"
import { selectedRows } from "./cursor.ts"
import { selectedPatch, type TuiState } from "./state.ts"

export const FRAME_PAD = 1

const PANE_BORDER = 2

const TREE_MAX = 34

const TREE_ROOMY = 40

const TREE_WIDE = 52

const TREE_MIN = 18

const TREE_SHARE = 0.3

const DIFF_MIN = 26

const PANEL_WIDTH = 34

const DIFF_ROOMY = 58

export const bodyRoom = (columns: number): number => Math.max(0, columns - FRAME_PAD * 2)

export const treeWidth = (columns: number): number => {
  const room = bodyRoom(columns)
  const spare = room - reviewWidth() - DIFF_ROOMY
  const most = spare >= TREE_WIDE ? TREE_WIDE : spare >= TREE_ROOMY ? TREE_ROOMY : TREE_MAX
  const wanted = Math.min(most, Math.max(TREE_MIN, Math.floor(room * TREE_SHARE)))
  return Math.max(0, Math.min(wanted, room - DIFF_MIN))
}

export const LEAST_COLUMNS = 24

export const LEAST_ROWS = 6

export const tooSmall = (columns: number, rows: number): boolean =>
  columns < LEAST_COLUMNS || rows < LEAST_ROWS

export const reviewWidth = (): number => PANEL_WIDTH + PANE_BORDER

export const panelFits = (state: TuiState): boolean =>
  bodyRoom(state.columns) - treeWidth(state.columns) - reviewWidth() >= DIFF_ROOMY

export const panelShown = (state: TuiState): boolean =>
  state.screen !== "branches" && state.panelOpen && panelFits(state)

export type LaidRow = { readonly text: string; readonly from: number }

const brokenAt = (text: string, room: number): number => {
  const space = text.lastIndexOf(" ", room)
  return space > 0 ? space + 1 : room
}

const laidLine = (line: string, from: number, room: number): ReadonlyArray<LaidRow> => {
  const rows: Array<LaidRow> = []
  let at = 0
  while (line.length - at > room) {
    const width = brokenAt(line.slice(at), room)
    rows.push({ text: line.slice(at, at + width), from: from + at })
    at += width
  }
  rows.push({ text: line.slice(at), from: from + at })
  return rows
}

export const laidDraft = (draft: string, room: number): ReadonlyArray<LaidRow> => {
  const width = Math.max(1, room)
  const rows: Array<LaidRow> = []
  let from = 0
  for (const line of draft.split("\n")) {
    rows.push(...laidLine(line, from, width))
    from += line.length + 1
  }
  return rows
}

export const caretRow = (rows: ReadonlyArray<LaidRow>, caret: number): number => {
  const at = rows.findIndex((row) => caret >= row.from && caret <= row.from + row.text.length)
  return at === -1 ? Math.max(0, rows.length - 1) : at
}

export const caretColumn = (rows: ReadonlyArray<LaidRow>, caret: number): number =>
  caret - (rows[caretRow(rows, caret)]?.from ?? 0)

export const caretOn = (
  rows: ReadonlyArray<LaidRow>,
  row: number,
  column: number,
): number => {
  const held = rows[Math.max(0, Math.min(rows.length - 1, row))]
  if (held === undefined) return 0
  const last = held.text.endsWith(" ") ? held.text.length - 1 : held.text.length
  return held.from + Math.min(column, Math.max(0, last))
}

const COMPOSE_BOX = 72

const COMPOSE_MARGIN = 4

const COMPOSE_PAD = 5

const COMPOSE_LEAST = 8

export const composeBox = (columns: number): number =>
  Math.max(0, Math.min(COMPOSE_BOX, columns - COMPOSE_MARGIN))

export const composeRoom = (columns: number): number =>
  Math.max(COMPOSE_LEAST, composeBox(columns) - COMPOSE_PAD)

export const selectionReadout = (state: TuiState): string => {
  const patch = selectedPatch(state)
  if (patch === undefined || !state.selecting) return ""
  const lines = selectedRows(state).length
  return `${patch.path}  ${lines} ${lines === 1 ? "line" : "lines"} selected`
}

export { WHOLE_FILE }
