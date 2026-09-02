import { fg, type TextChunk } from "@opentui/core"
import { hiddenLines } from "./cursor.ts"
import { filePlace, reviewedCount } from "./files.ts"
import { FRAME_PAD, WHOLE_FILE } from "./layout.ts"
import { marks } from "./marks.ts"
import { clipMiddle } from "./notespane.ts"
import { pullHere, selectedPatch, type TuiState } from "./state.ts"
import { palette } from "./theme.ts"
import { waitingLabel } from "./treepane.ts"
import { clip, wrapped } from "./words.ts"
import { GUTTER_X, PANEL_MAX } from "./chrome.ts"

export const BRANCH_WIDTH = 82

const BRANCH_NAME_MIN = 12

const BRANCH_FIXED = 36

const STATE_MIN = 11

export const EMPTY_LIST = "  nothing to review. No branch differs from the one it started from."

export const homeWidth = (width: number, longest: number, said = STATE_MIN): number =>
  Math.max(
    0,
    Math.min(
      width - FRAME_PAD * 2,
      Math.min(
        PANEL_MAX,
        Math.max(BRANCH_WIDTH, longest + BRANCH_FIXED + Math.max(STATE_MIN, said)),
      ),
    ),
  )

export const longestName = (state: TuiState): number =>
  Math.max(0, ...state.branches.map((branch) => branch.branch.length))

export const longestState = (state: TuiState): number =>
  Math.max(0, ...state.branches.map((branch) => stateCell(state, branch).length))

export const CHIP_CHUNKS = 3

export const shortPath = (path: string): string => {
  const home = process.env["HOME"] ?? ""
  return home.length > 0 && path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

const KEPT_TAIL = 2

export const HOME_PATH_MIN = 24

export const HOME_PATH_CHROME = 10

export const elide = (path: string, room: number): string => {
  if (path.length <= room) return path
  const parts = path.split("/").filter((part) => part.length > 0)
  const first = parts[0] ?? ""
  const name = parts.at(-1) ?? path
  const tail = parts.slice(-KEPT_TAIL).join("/")
  const rooted = path.startsWith("/") ? `/${first}` : path.startsWith("~") ? "~" : first
  const shorter = [`${rooted}/…/${tail}`, `…/${tail}`, `…/${name}`]
  return shorter.find((option) => option.length <= room) ?? clipMiddle(name, room)
}

const SUMMARY_LINES = 5

export const summaryLines = (
  summary: string,
  room: number,
  rail: number = Number.MAX_SAFE_INTEGER,
): ReadonlyArray<string> => {
  const said = summary.trim()
  if (said.length === 0) return []
  const most = Math.max(2, Math.min(SUMMARY_LINES, Math.floor(rail / 6)))
  const lines = wrapped(said, Math.max(1, room))
  const kept = lines.slice(0, most)
  const last = kept.at(-1) ?? ""
  const shortened = lines.length > most ? [...kept.slice(0, -1), clip(`${last}…`, room)] : kept
  return [...shortened.map((line) => ` ${line}`), ""]
}

const contextLabel = (context: number): string => {
  if (context === 3) return ""
  return context >= WHOLE_FILE ? "whole file" : `±${context}`
}

type Cells = {
  readonly name: string
  readonly files: string
  readonly added: string
  readonly gone: string
  readonly layers: string
  readonly state: string
}

export const nameRoom = (pane: number, longest = pane): number =>
  Math.max(BRANCH_NAME_MIN, Math.min(longest, pane - BRANCH_FIXED - STATE_MIN))

export const stateRoom = (pane: number, name: number): number => Math.max(0, pane - name - BRANCH_FIXED)

export const columns = (cells: Cells, room: number): string =>
  `${clip(cells.name, room).padEnd(room)}${cells.files.padStart(5)}${cells.added.padStart(8)}${cells.gone.padStart(8)}  ${cells.layers.padStart(8)}   ${cells.state}`

const FORGE_SILENT = "  could not reach the forge, so no pull request is shown"

export const unaskedForge = (state: TuiState): ReadonlyArray<TextChunk> =>
  state.forge === "silent" ? [fg(palette.attention)(`\n${FORGE_SILENT}`)] : []

export const branchHeading = (room: number): string =>
  `  ${columns(
    { name: "BRANCH", files: "FILES", added: "+", gone: "-", layers: "LAYERS", state: "STATE" },
    room,
  )}`

export const atHome = (state: TuiState): boolean =>
  state.screen === "branches" ||
  ((state.screen === "palette" || state.screen === "keys") && state.returnTo === "branches")

const layersCell = (branch: TuiState["branches"][number]): string => {
  if (branch.layers === 0) return ""
  return branch.stale ? `${branch.layers} stale` : `${branch.layers} layers`
}

const baseLabel = (branch: TuiState["branches"][number]): string =>
  branch.basis === "default" ? "" : `on ${branch.base}`

export const stateCell = (state: TuiState, branch: TuiState["branches"][number]): string =>
  [
    branch.own ? "here" : "",
    baseLabel(branch),
    state.pulls[branch.branch] ?? "",
    waitingLabel(branch).trim(),
  ]
    .filter((part) => part.length > 0)
    .join("  ")

export const branchCells = (branch: TuiState["branches"][number], here: boolean, room: number) => ({
  lead: `${here ? marks().cursor : " "} `,
  name: clipMiddle(branch.branch, room).padEnd(room),
  files: `${branch.files}`.padStart(5),
  added: `+${branch.added}`.padStart(8),
  gone: `-${branch.removed}`.padStart(8),
  layers: layersCell(branch),
  state: "",
})

const placeLabel = (state: TuiState): string => {
  const place = filePlace(state)
  return `file ${place.at} of ${place.of}`
}

export const headerParts = (
  state: TuiState,
  branch: string,
  path: string,
  across: { readonly pan: number; readonly cutOff: number },
): ReadonlyArray<string> => [
  branch,
  path,
  state.patches.length === 0 ? "nothing to read" : placeLabel(state),
  pullHere(state).length === 0 ? "" : `${pullHere(state)} pull request`,
  state.vouched.length === 0 ? "" : reviewedCount(state),
  contextLabel(state.context),
  state.layersStale ? "layers stale · L for a new one" : "",
  hiddenLines(state) === 0 ? "" : `⋯ ${hiddenLines(state)} ${hiddenLines(state) === 1 ? "line" : "lines"} hidden`,
  panLabel(state, across),
]

const panLabel = (
  state: TuiState,
  across: { readonly pan: number; readonly cutOff: number },
): string => {
  if (across.pan > 0) return `→ ${across.pan} columns`
  if (state.wrap || across.cutOff === 0) return ""
  return `→ ${across.cutOff} columns cut off, > pans`
}

const HEADER_GAP = 2

const HEADER_PATH_MIN = 20

export const headerRoom = (width: number): number => Math.max(0, width - FRAME_PAD * 2 - GUTTER_X * 2)

export const headerFitted = (
  parts: ReadonlyArray<string>,
  path: string,
  room: number,
): ReadonlyArray<string> => {
  const gaps = HEADER_GAP * Math.max(0, parts.length - 1)
  const spent = parts.reduce((total, part) => total + part.length, gaps)
  if (path.length === 0 || spent <= room) return parts
  const left = Math.max(HEADER_PATH_MIN, path.length - (spent - room))
  return parts.map((part) => (part === path ? elide(path, left) : part))
}

export const fallbackScope = (state: TuiState, top: number): ReadonlyArray<string> => {
  const found = selectedPatch(state)?.hunks.findLast((hunk) => hunk.startRow < top)
  const scope = found?.scope ?? ""
  return scope.length === 0 ? [] : [scope]
}
