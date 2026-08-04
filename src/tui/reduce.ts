import type { Patch } from "../domain/patch/index.ts"
import type { Action } from "./command.ts"
import { gapNumbered } from "./gaps.ts"
import { searchCommands } from "./match.ts"
import {
  crowdedOf,
  directoryOfFile,
  fileOrder,
  hunkStarts,
  onLayers,
  selectedPatch,
  layerFile,
  layerFiles,
  layerHolding,
  type TuiState,
  commentRowsIn,
  filesWithComments,
  rowAtSourceLine,
} from "./model.ts"

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value))

const lastRow = (patch: Patch | undefined): number => Math.max(0, (patch?.rows.length ?? 1) - 1)

const rowsIn = (state: TuiState): number => selectedPatch(state)?.rows.length ?? 0

const withCursorVisible = (state: TuiState): TuiState => {
  const height = Math.max(1, state.viewport)
  const highest = Math.max(0, rowsIn(state) - height)
  const top = state.cursor < state.top ? state.cursor : state.cursor >= state.top + height ? state.cursor - height + 1 : state.top
  return { ...state, top: clamp(top, 0, highest) }
}

const moveCursor = (state: TuiState, delta: number): TuiState =>
  withCursorVisible({
    ...state,
    cursor: clamp(state.cursor + delta, 0, lastRow(selectedPatch(state))),
  })

export const scrolled = (state: TuiState, delta: number): TuiState => {
  const highest = Math.max(0, rowsIn(state) - Math.max(1, state.viewport))
  return { ...state, top: clamp(state.top + delta, 0, highest) }
}

export const draggedTo = (state: TuiState, from: number, to: number): TuiState => ({
  ...state,
  selecting: true,
  anchorRow: clamp(from, 0, lastRow(selectedPatch(state))),
  cursor: clamp(to, 0, lastRow(selectedPatch(state))),
})

const atRow = (state: TuiState, row: number): TuiState =>
  withCursorVisible({ ...state, cursor: clamp(row, 0, lastRow(selectedPatch(state))) })

const layerHunk = (state: TuiState, delta: number): TuiState => {
  const starts = hunkStarts(state)
  const target =
    delta > 0
      ? starts.find((start) => start > state.cursor)
      : starts.findLast((start) => start < state.cursor)
  return target === undefined ? state : atRow(state, target)
}

const nextFileWithComments = (state: TuiState, delta: number): number | undefined => {
  const elsewhere = filesWithComments(state).filter((index) => index !== state.patchIndex)
  if (delta > 0) return elsewhere.find((index) => index > state.patchIndex) ?? elsewhere[0]
  return elsewhere.findLast((index) => index < state.patchIndex) ?? elsewhere.at(-1)
}

const atComment = (state: TuiState, file: number, delta: number): TuiState => {
  const moved = { ...state, patchIndex: file, top: 0, cursor: 0, anchorRow: 0, selecting: false }
  const rows = commentRowsIn(moved, file)
  const landing = delta > 0 ? rows[0] : rows.at(-1)
  return landing === undefined ? moved : atRow(moved, landing)
}

const layerComment = (state: TuiState, delta: number): TuiState => {
  const here = commentRowsIn(state, state.patchIndex)
  const target =
    delta > 0
      ? here.find((row) => row > state.cursor)
      : here.findLast((row) => row < state.cursor)
  if (target !== undefined) return atRow(state, target)
  const file = nextFileWithComments(state, delta)
  if (file !== undefined) return atComment(state, file, delta)
  return here.length > 0 ? state : withNotice(state, "no comments yet")
}

const movePending = (state: TuiState, delta: number): TuiState => ({
  ...state,
  pendingIndex: clamp(state.pendingIndex + delta, 0, Math.max(0, state.pending.length - 1)),
})

const moveLayer = (state: TuiState, delta: number): TuiState => {
  const layerIndex = clamp(state.layerIndex + delta, 0, Math.max(0, state.layers.length - 1))
  const landed = { ...state, layerIndex }
  const patchIndex = layerFiles(landed, layerIndex)[0] ?? landed.patchIndex
  return { ...landed, patchIndex, top: 0, cursor: 0, anchorRow: 0, selecting: false }
}

const inRail = (state: TuiState, delta: number): TuiState =>
  onLayers(state) ? moveLayer(state, delta) : moveFile(state, delta)

const layerDown = (state: TuiState, delta: number): TuiState =>
  state.focus === "tree" ? inRail(state, delta) : moveCursor(state, delta)

const toggleRail = (state: TuiState): TuiState => {
  if (state.layers.length === 0) return withNotice(state, "no layers for this branch")
  if (state.rail === "layers") return { ...state, rail: "tree" }
  return { ...state, rail: "layers", layerIndex: layerHolding(state, state.patchIndex) }
}

const foldDirectory = (state: TuiState, shut: boolean): TuiState => {
  const directory = directoryOfFile(state, state.patchIndex)
  if (directory === undefined) return state
  const closed = state.closed.filter((path) => path !== directory)
  return { ...state, closed: shut ? [...closed, directory] : closed }
}

const foldLayer = (state: TuiState, shut: boolean): TuiState => {
  const open = state.openLayers.filter((index) => index !== state.layerIndex)
  return { ...state, openLayers: shut ? open : [...open, state.layerIndex] }
}

const fold = (state: TuiState, shut: boolean): TuiState =>
  onLayers(state) ? foldLayer(state, shut) : foldDirectory(state, shut)

const moveBranch = (state: TuiState, delta: number): TuiState => ({
  ...state,
  branchIndex: clamp(state.branchIndex + delta, 0, Math.max(0, state.branches.length - 1)),
})

const moveFile = (state: TuiState, delta: number): TuiState => ({
  ...state,
  patchIndex: layerFile(state, delta),
  top: 0,
  cursor: 0,
  anchorRow: 0,
  selecting: false,
})

const startSelection = (state: TuiState): TuiState => ({
  ...state,
  selecting: true,
  anchorRow: state.cursor,
})

const openCompose = (state: TuiState): TuiState => ({
  ...state,
  screen: "compose",
  draft: "",
  anchorRow: state.selecting ? state.anchorRow : state.cursor,
})

const goBack = (state: TuiState): TuiState => {
  if (state.screen === "pending") return { ...state, screen: "review" }
  if (state.screen === "report") return { ...state, screen: state.returnTo, draft: "" }
  if (state.screen === "palette") return { ...state, screen: state.returnTo, query: "" }
  if (state.screen === "compose") return { ...state, screen: "review", draft: "" }
  if (state.selecting) return { ...state, selecting: false, anchorRow: state.cursor }
  return { ...state, screen: "branches", selecting: false }
}

const openPalette = (state: TuiState): TuiState => ({
  ...state,
  screen: "palette",
  returnTo: state.screen,
  query: "",
  paletteIndex: 0,
})

const movePalette = (state: TuiState, delta: number): TuiState => ({
  ...state,
  paletteIndex: clamp(state.paletteIndex + delta, 0, Math.max(0, paletteMatches(state).length - 1)),
})

export const paletteMatches = (state: TuiState) => searchCommands(state.returnTo, state.query)

export const paletteChoice = (state: TuiState): Action | undefined =>
  paletteMatches(state)[state.paletteIndex]?.action

const transitions: Record<Action, (state: TuiState) => TuiState> = {
  "branch.next": (state) => moveBranch(state, 1),
  "branch.prev": (state) => moveBranch(state, -1),
  "branch.open": (state) => state,
  "cursor.next": (state) => layerDown(state, 1),
  "cursor.top": (state) => atRow(state, 0),
  "cursor.bottom": (state) => atRow(state, lastRow(selectedPatch(state))),
  "cursor.pageDown": (state) => moveCursor(state, Math.max(1, Math.floor(state.viewport / 2))),
  "cursor.pageUp": (state) => moveCursor(state, -Math.max(1, Math.floor(state.viewport / 2))),
  "context.more": (state) => state,
  "context.less": (state) => state,
  "comment.next": (state) => layerComment(state, 1),
  "comment.prev": (state) => layerComment(state, -1),
  "hunk.next": (state) => layerHunk(state, 1),
  "hunk.prev": (state) => layerHunk(state, -1),
  "cursor.prev": (state) => layerDown(state, -1),
  "file.next": (state) => moveFile(state, 1),
  "file.prev": (state) => moveFile(state, -1),
  "select.start": startSelection,
  "compose.open": openCompose,
  "compose.submit": (state) => state,
  "compose.stage": (state) => state,
  "pending.open": (state) => state,
  "pending.submit": (state) => state,
  "pending.edit": (state) => state,
  "pending.drop": (state) => state,
  "pending.next": (state) => movePending(state, 1),
  "pending.prev": (state) => movePending(state, -1),
  "compose.newline": (state) => ({ ...state, draft: `${state.draft}\n` }),
  "focus.toggle": (state) => ({
    ...state,
    focus: state.focus === "diff" ? "tree" : "diff",
    navOpen: true,
  }),
  "nav.zoom": (state) => ({ ...state, navOpen: !state.navOpen, focus: "diff" }),
  "wrap.toggle": (state) => ({ ...state, wrap: !state.wrap }),
  "review.reload": (state) => state,
  "rail.toggle": toggleRail,
  "file.vouch": (state) => state,
  "file.vouch.next": (state) => state,
  "tree.collapse": (state) => fold(state, true),
  "tree.expand": (state) => fold(state, false),
  "report.open": (state) => ({ ...state, screen: "report", draft: "", returnTo: state.screen }),
  "report.send": (state) => state,
  "palette.open": openPalette,
  "palette.run": (state) => state,
  back: goBack,
  quit: (state) => state,
}

export const reduce = (state: TuiState, action: Action): TuiState => transitions[action](state)

export const atFile = (state: TuiState, patchIndex: number): TuiState => ({
  ...state,
  patchIndex,
  cursor: 0,
  anchorRow: 0,
  selecting: false,
})

export const withContext = (
  state: TuiState,
  context: number,
  patches: ReadonlyArray<Patch>,
  cursor: number,
): TuiState => ({
  ...state,
  context,
  patches,
  revealed: [],
  cursor,
  anchorRow: cursor,
  selecting: false,
})

export const withFull = (state: TuiState, full: ReadonlyArray<Patch>): TuiState => ({
  ...state,
  full,
})

const revealsAfter = (state: TuiState, gap: number, lines: number): TuiState["revealed"] => {
  const path = state.patches[state.patchIndex]?.path ?? ""
  const others = state.revealed.filter((entry) => entry.file !== path || entry.gap !== gap)
  return lines <= 0 ? others : [...others, { file: path, gap, lines }]
}

export const gapOpened = (state: TuiState, gap: number, delta: number): TuiState => {
  const path = state.patches[state.patchIndex]?.path ?? ""
  const now = state.revealed.find((entry) => entry.file === path && entry.gap === gap)?.lines ?? 0
  const opened = { ...state, revealed: revealsAfter(state, gap, now + delta) }
  const wanted = gapNumbered(opened, gap)?.row ?? state.cursor
  const landed = clamp(wanted, 0, lastRow(selectedPatch(opened)))
  return withCursorVisible({ ...opened, cursor: landed, anchorRow: landed, selecting: false })
}

export const withPending = (
  state: TuiState,
  pending: TuiState["pending"],
  screen: TuiState["screen"],
): TuiState => ({ ...state, pending, pendingIndex: 0, staged: pending.length, screen })

export const withSent = (state: TuiState, sent: TuiState["sent"]): TuiState => ({ ...state, sent })

export const withLayers = (
  state: TuiState,
  told: { layers: TuiState["layers"]; stale: boolean },
): TuiState => {
  const layers = told.layers
  const opened: TuiState = {
    ...state,
    layers,
    layersStale: told.stale,
    layerIndex: 0,
    openLayers: [],
    rail: layers.length === 0 ? "tree" : "layers",
  }
  if (layers.length === 0) return opened
  return { ...opened, patchIndex: layerFiles(opened, 0)[0] ?? opened.patchIndex, cursor: 0, top: 0 }
}

export const withPulls = (
  state: TuiState,
  pulls: Readonly<Record<string, string>>,
): TuiState => ({ ...state, pulls })

export const withBranches = (
  state: TuiState,
  branches: TuiState["branches"],
): TuiState => ({ ...state, branches, branchIndex: Math.min(state.branchIndex, Math.max(0, branches.length - 1)) })

export const withSource = (state: TuiState, source: ReadonlyArray<string>): TuiState => ({
  ...state,
  source,
})

export const withVouched = (state: TuiState, vouched: ReadonlyArray<string>): TuiState => ({
  ...state,
  vouched,
})

export const restoredTo = (
  state: TuiState,
  path: string | undefined,
  line: number | undefined,
): TuiState => {
  const index = state.patches.findIndex((patch) => patch.path === path)
  const patch = state.patches[index]
  if (patch === undefined) return state
  return withCursorVisible({
    ...state,
    patchIndex: index,
    cursor: line === undefined ? 0 : rowAtSourceLine(patch, line),
  })
}

export const withPatches = (state: TuiState, patches: ReadonlyArray<Patch>): TuiState => ({
  ...state,
  screen: "review",
  patches,
  full: [],
  revealed: [],
  closed: crowdedOf(patches),
  patchIndex: fileOrder({ ...state, patches, closed: crowdedOf(patches) })[0] ?? 0,
  cursor: 0,
  anchorRow: 0,
  selecting: false,
})

export const typed = (state: TuiState, character: string): TuiState =>
  state.screen === "palette"
    ? { ...state, query: `${state.query}${character}`, paletteIndex: 0 }
    : { ...state, draft: `${state.draft}${character}` }

export const backspaced = (state: TuiState): TuiState =>
  state.screen === "palette"
    ? { ...state, query: state.query.slice(0, -1), paletteIndex: 0 }
    : { ...state, draft: state.draft.slice(0, -1) }

export const paletteMoved = (state: TuiState, delta: number): TuiState => movePalette(state, delta)

export const paletteClosed = (state: TuiState): TuiState => ({
  ...state,
  screen: state.returnTo,
  query: "",
})

export const withNoticeHere = (state: TuiState, notice: string): TuiState => ({
  ...state,
  notice,
})

export const withNotice = (state: TuiState, notice: string): TuiState => ({
  ...state,
  screen: "review",
  draft: "",
  selecting: false,
  notice,
})
