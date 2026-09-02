import { bg, type TextChunk } from "@opentui/core"
import { absurd } from "effect"
import { REMAINDER_TITLE } from "../domain/layers/index.ts"
import { isReviewed } from "./files.ts"
import {
  layerDone,
  type LayerRoom,
  RAIL_DIR_LEAD,
  RAIL_FILE_LEAD,
  RAIL_GUTTER,
  RAIL_TITLE_LEAD,
} from "./layerview.ts"
import { marks, standMark } from "./marks.ts"
import { threadsOn } from "./notes.ts"
import { clipMiddle, clipPath } from "./notespane.ts"
import { restingOrHere } from "./panelpane.ts"
import type { LayerRow, TuiState } from "./state.ts"
import { palette } from "./theme.ts"
import type { TreeRow } from "./tree.ts"
import { clip, wrapped } from "./words.ts"
import { PANE_CHROME } from "./chrome.ts"

const INDENT_MAX = 3

const treeLabel = (state: TuiState, row: TreeRow, room: number): string => {
  const indent = " ".repeat(Math.min(row.depth, INDENT_MAX))
  if (row.kind === "file") {
    const lead = `${indent}  `
    return `${lead}${clipMiddle(row.name, Math.max(4, room - lead.length))}`
  }
  const shut = state.closed.includes(row.path)
  const lead = `${indent}${shut ? marks().shut : marks().open} `
  return `${lead}${clipPath(row.name, Math.max(4, room - lead.length))}`
}

export const waitingLabel = (branch: TuiState["branches"][number]): string =>
  branch.unanswered > 0 ? `${branch.unanswered} unanswered` : ""

export const inRange = (state: TuiState, row: number, from: number, to: number): boolean =>
  state.selecting && row >= from && row <= to

const treeMarks = (state: TuiState, row: TreeRow): string => {
  const seen = row.fileIndex !== undefined && isReviewed(state, row.fileIndex) ? marks().done : " "
  const here = row.fileIndex !== undefined && row.fileIndex === state.patchIndex
  return `${here ? marks().cursor : " "}${seen}`
}

const treeTail = (state: TuiState, row: TreeRow): string => {
  if (row.fileIndex === undefined) return "  "
  const threads = threadsOn(state, row.fileIndex)
  return threads.open > 0 ? `${threads.open}${standMark(threads.stand)}`.padStart(3) : "   "
}

export const treeLine = (state: TuiState, row: TreeRow, pane: number): string => {
  const tail = treeTail(state, row)
  const room = Math.max(4, pane - PANE_CHROME - 2 - tail.length)
  return `${treeMarks(state, row)}${clip(treeLabel(state, row, room), room).padEnd(room)}${tail}`
}

const GUTTER = RAIL_GUTTER

const DIR_LEAD = RAIL_DIR_LEAD

const TITLE_LEAD = RAIL_TITLE_LEAD

const FILE_LEAD = RAIL_FILE_LEAD

const STALE_ROOM = 13

const STALE_ASKING = 24

const STALE_LONG = "stale, the branch moved on — press L to ask for a new one"

const STALE_MIDDLE = "stale, the branch moved on"

const STALE_SHORT = "stale"

const staleSaid = (room: number): string => {
  if (room >= STALE_ASKING) return STALE_LONG
  return room >= STALE_ROOM ? STALE_MIDDLE : STALE_SHORT
}

export const staleBanner = (room: number): string =>
  wrapped(staleSaid(room), room)
    .map((line) => ` ${line}`)
    .join("\n")

type LayerLook = {
  readonly lead: number
  readonly mark: string
  readonly paint: string
}

export const litRow = (row: LayerRow, state: TuiState, drawn: TextChunk): TextChunk =>
  row.here === true ? bg(restingOrHere(state.focus === "tree"))(drawn) : drawn

const leftOver = (state: TuiState, layerIndex: number): boolean =>
  state.layers[layerIndex]?.title === REMAINDER_TITLE

const titlePaint = (state: TuiState, layerIndex: number): string => {
  const here = layerIndex === state.layerIndex
  if (leftOver(state, layerIndex)) return here ? palette.attention : palette.faint
  if (layerDone(state, layerIndex)) return palette.faint
  return here ? palette.ink : palette.muted
}

const titleMark = (state: TuiState, row: LayerRow): string => {
  if (!row.lead) return " "
  if (layerDone(state, row.index)) return marks().done
  if (leftOver(state, row.index)) return "0"
  return `${row.index + 1}`
}

const titleLook = (state: TuiState, row: LayerRow): LayerLook => ({
  lead: TITLE_LEAD,
  mark: titleMark(state, row),
  paint: titlePaint(state, row.index),
})

const fileMark = (state: TuiState, row: LayerRow): string => {
  const threads = row.fileIndex === undefined ? undefined : threadsOn(state, row.fileIndex)
  if (threads !== undefined && threads.open > 0) return standMark(threads.stand)
  return row.reviewed === true ? marks().done : " "
}

const fileLook = (state: TuiState, row: LayerRow): LayerLook => ({
  lead: FILE_LEAD,
  mark: fileMark(state, row),
  paint: row.reviewed === true ? palette.added : palette.ink,
})

export const layerLook = (state: TuiState, row: LayerRow): LayerLook => {
  switch (row.kind) {
    case "file":
      return fileLook(state, row)
    case "dir":
      return { lead: DIR_LEAD, mark: " ", paint: palette.faint }
    case "count":
      return { lead: DIR_LEAD, mark: " ", paint: palette.faint }
    case "gap":
      return { lead: TITLE_LEAD, mark: " ", paint: palette.faint }
    case "note":
      return { lead: FILE_LEAD, mark: " ", paint: palette.muted }
    case "title":
      return titleLook(state, row)
    default:
      return absurd(row.kind)
  }
}

const layerGutter = (row: LayerRow, look: LayerLook): string => {
  const here = row.here === true ? marks().cursor : " "
  return `${here}${look.mark.padStart(GUTTER - 1)}`
}

export const layerText = (row: LayerRow, look: LayerLook, room: LayerRoom): string =>
  row.kind === "gap"
    ? ""
    : `${layerGutter(row, look)}${" ".repeat(look.lead - GUTTER)}${row.text}`.padEnd(
        room.title + TITLE_LEAD,
      )
