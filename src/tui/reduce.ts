import { stripAnsiSequences } from "@opentui/core"
import { Option } from "effect"
import { anchorFor, type Patch } from "../domain/patch/index.ts"
import { glossaryFor, type Action } from "./command.ts"
import { gapNumbered } from "./gaps.ts"
import { searchCommands } from "./match.ts"
import {
  crowdedOf,
  foldersOfFile,
  fileOrder,
  changeAround,
  hunkStarts,
  onLayers,
  selectedPatch,
  selectionRange,
  layerFile,
  layerFiles,
  layerHolding,
  type TuiState,
  commentRowsIn,
  openCommentRows,
  filesWithComments,
  rowAtSourceLine,
  rowShowing,
  stopsAtRow,
  WHOLE_FILE,
  threadAtStop,
  panelEntries,
  panelFits,
  panelShown,
  caretAt,
  caretByWord,
  caretToEdge,
} from "./model.ts"

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value))

const lastRow = (patch: Patch | undefined): number => Math.max(0, (patch?.rows.length ?? 1) - 1)

const rowsIn = (state: TuiState): number => selectedPatch(state)?.rows.length ?? 0

const withCursorVisible = (state: TuiState): TuiState => {
  const height = Math.max(1, state.viewport)
  const highest = Math.max(0, rowsIn(state) - height)
  const top = state.cursor < state.top ? state.cursor : state.cursor >= state.top + height ? state.cursor - height + 1 : state.top
  return { ...state, scroll: -1, top: clamp(top, 0, highest) }
}

const moveCursor = (state: TuiState, delta: number): TuiState =>
  withCursorVisible({
    ...state,
    stop: 0,
    cursor: clamp(state.cursor + delta, 0, lastRow(selectedPatch(state))),
  })

const stepStop = (state: TuiState, delta: number): TuiState => {
  const here = stopsAtRow(state, state.cursor) - 1
  if (delta > 0 && state.stop < here) return { ...state, stop: state.stop + 1 }
  if (delta < 0 && state.stop > 0) return { ...state, stop: state.stop - 1 }
  const row = clamp(state.cursor + delta, 0, lastRow(selectedPatch(state)))
  if (row === state.cursor) return state
  const landing = delta < 0 ? stopsAtRow({ ...state, cursor: row }, row) - 1 : 0
  return withCursorVisible({ ...state, cursor: row, stop: landing })
}

export const scrolled = (state: TuiState, delta: number): TuiState => {
  const height = Math.max(1, state.viewport)
  const highest = Math.max(0, state.tallest - height)
  const from = state.scroll === -1 ? state.top : state.scroll
  return { ...state, scroll: clamp(from + delta, 0, highest) }
}

export const draggedTo = (state: TuiState, from: number, to: number): TuiState => ({
  ...state,
  selecting: true,
  anchorRow: clamp(from, 0, lastRow(selectedPatch(state))),
  cursor: clamp(to, 0, lastRow(selectedPatch(state))),
})

const atRow = (state: TuiState, row: number): TuiState =>
  withCursorVisible({ ...state, stop: 0, cursor: clamp(row, 0, lastRow(selectedPatch(state))) })

const noneLeft = (state: TuiState, delta: number): TuiState => {
  const none = hunkStarts(state).length === 0
  const way = delta > 0 ? "after" : "before"
  return withNotice(state, none ? "nothing changed in this file" : `no change ${way} this one`)
}

const layerHunk = (state: TuiState, delta: number): TuiState => {
  const starts = hunkStarts(state)
  const target =
    delta > 0
      ? starts.find((start) => start > state.cursor)
      : starts.findLast((start) => start < state.cursor)
  return target === undefined ? noneLeft(state, delta) : atRow(state, target)
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

const nothingOpen = (state: TuiState): TuiState => {
  const any = commentRowsIn(state, state.patchIndex).length > 0
  return withNotice(state, any ? "no open comment" : "no comments yet")
}

const layerComment = (state: TuiState, delta: number): TuiState => {
  const here = openCommentRows(state)
  const target =
    delta > 0
      ? here.find((row) => row > state.cursor)
      : here.findLast((row) => row < state.cursor)
  if (target !== undefined) return atRow(state, target)
  const file = nextFileWithComments(state, delta)
  if (file !== undefined) return atComment(state, file, delta)
  return here.length > 0 ? state : nothingOpen(state)
}

const PAN_STEP = 8

const panned = (state: TuiState, delta: number): TuiState => {
  if (state.wrap) return withNotice(state, "wrapping is on, so there is nothing to pan")
  return { ...state, pan: Math.max(0, state.pan + delta) }
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

const movePanel = (state: TuiState, delta: number): TuiState => ({
  ...state,
  panelIndex: clamp(state.panelIndex + delta, 0, Math.max(0, panelEntries(state).length - 1)),
})

const layerDown = (state: TuiState, delta: number): TuiState => {
  if (state.focus === "tree") return inRail(state, delta)
  if (state.focus === "review") return movePanel(state, delta)
  return stepStop(state, delta)
}

const PANES: ReadonlyArray<TuiState["focus"]> = ["tree", "diff", "review"]

const panesShown = (state: TuiState): ReadonlyArray<TuiState["focus"]> =>
  PANES.filter((pane) => pane !== "review" || panelShown(state))

const focusStepped = (state: TuiState, delta: number): TuiState["focus"] => {
  const shown = panesShown(state)
  const at = shown.indexOf(state.focus)
  const from = at === -1 ? 0 : at
  return shown[(from + delta + shown.length) % shown.length] ?? state.focus
}

const togglePanel = (state: TuiState): TuiState => {
  if (!state.panelOpen && !panelFits(state)) {
    return withNotice(state, "the terminal is too narrow for the review panel")
  }
  const panelOpen = !state.panelOpen
  return {
    ...state,
    panelOpen,
    panelWas: panelOpen,
    focus: panelOpen ? state.focus : "diff",
    panelIndex: 0,
  }
}

const packedAway = (state: TuiState): boolean => !state.navOpen && !state.panelOpen

const zoom = (state: TuiState): TuiState =>
  packedAway(state)
    ? { ...state, navOpen: true, panelOpen: state.panelWas, focus: "diff" }
    : { ...state, navOpen: false, panelOpen: false, focus: "diff" }

const toggleRail = (state: TuiState): TuiState => {
  if (state.layers.length === 0) return withNotice(state, "no layers for this branch")
  if (state.rail === "layers") return { ...state, rail: "tree" }
  return { ...state, rail: "layers", layerIndex: layerHolding(state, state.patchIndex) }
}

const foldDirectory = (state: TuiState, shut: boolean): TuiState => {
  const chain = foldersOfFile(state, state.patchIndex)
  if (chain.length === 0) return state
  const target = shut
    ? chain.find((path) => !state.closed.includes(path))
    : chain.findLast((path) => state.closed.includes(path))
  if (target === undefined) return state
  const closed = state.closed.filter((path) => path !== target)
  return { ...state, closed: shut ? [...closed, target] : closed }
}

const foldLayer = (state: TuiState, shut: boolean): TuiState => {
  const open = state.openLayers.filter((index) => index !== state.layerIndex)
  return { ...state, openLayers: shut ? open : [...open, state.layerIndex] }
}

const foldThread = (state: TuiState, shut: boolean, id: string): TuiState => {
  const rest = state.opened.filter((held) => held !== id)
  return { ...state, opened: shut ? rest : [...rest, id] }
}

const fold = (state: TuiState, shut: boolean): TuiState => {
  const thread = threadAtStop(state)
  if (thread?.id !== undefined && thread.settled === true) {
    return foldThread(state, shut, thread.id)
  }
  return onLayers(state) ? foldLayer(state, shut) : foldDirectory(state, shut)
}

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

const selectHunk = (state: TuiState): TuiState => {
  const found = changeAround(state)
  if (found === undefined) return withNotice(state, "no change under the cursor")
  return withCursorVisible({ ...state, selecting: true, anchorRow: found[0], cursor: found[1] })
}

const swapEnds = (state: TuiState): TuiState =>
  state.selecting
    ? withCursorVisible({ ...state, anchorRow: state.cursor, cursor: state.anchorRow })
    : state

const atBranch = (state: TuiState, at: number): TuiState => ({
  ...state,
  branchIndex: clamp(at, 0, Math.max(0, state.branches.length - 1)),
})

const startSelection = (state: TuiState): TuiState => ({
  ...state,
  selecting: true,
  anchorRow: state.cursor,
})

const openCompose = (state: TuiState): TuiState => {
  const patch = selectedPatch(state)
  const [from, to] = selectionRange(state)
  const anchored = patch !== undefined && Option.isSome(anchorFor(patch, from, to))
  if (!anchored) return withNoticeHere(state, "no line here to comment on")
  return {
    ...state,
    screen: "compose",
    draft: "",
    caret: 0,
    anchorRow: state.selecting ? state.anchorRow : state.cursor,
  }
}

const goBack = (state: TuiState): TuiState => {
  if (state.screen === "search") return { ...state, screen: "review", matches: [], term: "" }
  if (state.screen === "pending") return { ...state, screen: "review" }
  if (state.screen === "report") return { ...state, screen: state.returnTo, draft: "", caret: 0 }
  if (state.screen === "palette") return { ...state, screen: state.returnTo, query: "" }
  if (state.screen === "keys") return { ...state, screen: state.returnTo }
  if (state.screen === "compose") return { ...state, screen: "review", draft: "", caret: 0 }
  if (state.selecting) return { ...state, selecting: false, anchorRow: state.cursor }
  return { ...state, screen: "branches", selecting: false }
}

const walkMatches = (state: TuiState, delta: number): TuiState => ({
  ...state,
  matchIndex: clamp(state.matchIndex + delta, 0, Math.max(0, state.matches.length - 1)),
})

const openPalette = (state: TuiState): TuiState => ({
  ...state,
  screen: "palette",
  returnTo: state.screen,
  query: "",
  paletteIndex: 0,
})

const openKeys = (state: TuiState): TuiState => ({
  ...state,
  screen: "keys",
  returnTo: state.screen,
  query: "",
  paletteIndex: 0,
})

const movePalette = (state: TuiState, delta: number): TuiState => ({
  ...state,
  paletteIndex: clamp(state.paletteIndex + delta, 0, Math.max(0, offered(state).length - 1)),
})

export const paletteMatches = (state: TuiState) => searchCommands(state.returnTo, state.query)

export const offered = (state: TuiState) =>
  state.screen === "keys" ? glossaryFor(state.returnTo) : paletteMatches(state)

export const paletteChoice = (state: TuiState): Action | undefined =>
  offered(state)[state.paletteIndex]?.action

const transitions: Record<Action, (state: TuiState) => TuiState> = {
  "branch.first": (state) => atBranch(state, 0),
  "branch.last": (state) => atBranch(state, state.branches.length - 1),
  "branch.next": (state) => moveBranch(state, 1),
  "branch.prev": (state) => moveBranch(state, -1),
  "branch.open": (state) => state,
  "branch.pull": (state) => state,
  "cursor.next": (state) => layerDown(state, 1),
  "cursor.top": (state) => atRow(state, 0),
  "cursor.bottom": (state) => atRow(state, lastRow(selectedPatch(state))),
  "cursor.pageDown": (state) => moveCursor(state, Math.max(1, Math.floor(state.viewport / 2))),
  "cursor.pageUp": (state) => moveCursor(state, -Math.max(1, Math.floor(state.viewport / 2))),
  "context.more": (state) => state,
  "context.less": (state) => state,
  "context.whole": (state) => state,
  "comment.next": (state) => layerComment(state, 1),
  "comment.prev": (state) => layerComment(state, -1),
  "hunk.next": (state) => layerHunk(state, 1),
  "hunk.prev": (state) => layerHunk(state, -1),
  "cursor.prev": (state) => layerDown(state, -1),
  "file.next": (state) => moveFile(state, 1),
  "file.prev": (state) => moveFile(state, -1),
  "select.start": startSelection,
  "select.hunk": selectHunk,
  "select.swap": swapEnds,
  "compose.open": openCompose,
  "compose.submit": (state) => state,
  "compose.stage": (state) => state,
  "pending.open": (state) => state,
  "pending.submit": (state) => state,
  "pending.edit": (state) => state,
  "pending.drop": (state) => state,
  "pending.next": (state) => movePending(state, 1),
  "pending.prev": (state) => movePending(state, -1),
  "compose.newline": (state) => inserted(state, "\n"),
  "focus.toggle": (state) => ({ ...state, focus: focusStepped(state, 1), navOpen: true }),
  "focus.back": (state) => ({ ...state, focus: focusStepped(state, -1), navOpen: true }),
  "panel.toggle": togglePanel,
  "nav.zoom": zoom,
  "wrap.toggle": (state) => ({ ...state, wrap: !state.wrap, pan: 0 }),
  "pan.right": (state) => panned(state, PAN_STEP),
  "pan.left": (state) => panned(state, -PAN_STEP),
  "review.reload": (state) => state,
  "thread.settle": (state) => state,
  "thread.remove": (state) => state,
  "report.mode": (state) => ({ ...state, reportFull: !state.reportFull }),
  "panel.flip": (state) => ({ ...state, newestFirst: !state.newestFirst, panelIndex: 0 }),
  "tree.winnow": (state) => ({ ...state, hideReviewed: !state.hideReviewed }),
  "rail.toggle": toggleRail,
  "file.vouch": (state) => state,
  "file.vouch.next": (state) => state,
  "tree.collapse": (state) => fold(state, true),
  "tree.expand": (state) => fold(state, false),
  "report.open": (state) => ({
    ...state,
    screen: "report",
    draft: "",
    caret: 0,
    returnTo: state.screen,
  }),
  "report.send": (state) => state,
  "palette.open": openPalette,
  "keys.open": openKeys,
  "keys.next": (state) => movePalette(state, 1),
  "keys.prev": (state) => movePalette(state, -1),
  "palette.run": (state) => state,
  "search.open": (state) => state,
  "search.jump": (state) => state,
  "match.next": (state) => walkMatches(state, 1),
  "match.prev": (state) => walkMatches(state, -1),
  "selection.copy": (state) => state,
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
  contextWas: state.context < WHOLE_FILE ? state.context : state.contextWas,
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

export const panBy = (state: TuiState, delta: number): TuiState =>
  state.wrap ? state : { ...state, pan: Math.max(0, state.pan + delta) }

export const withSent = (state: TuiState, sent: TuiState["sent"]): TuiState => ({
  ...state,
  sent,
  arrived: [],
  panelIndex: 0,
})

export const withArrived = (state: TuiState, arrived: TuiState["arrived"]): TuiState => ({
  ...state,
  arrived,
})

export const withColumns = (state: TuiState, columns: number): TuiState => ({ ...state, columns })

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
): TuiState => ({ ...state, pulls, forge: "answered" })

export const withSilentForge = (state: TuiState): TuiState => ({ ...state, forge: "silent" })

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
  offset: number,
): TuiState => {
  const index = state.patches.findIndex((patch) => patch.path === path)
  const patch = state.patches[index]
  if (patch === undefined) return state
  const cursor = line === undefined ? 0 : rowAtSourceLine(patch, line)
  const top = clamp(cursor - Math.max(0, offset), 0, Math.max(0, patch.rows.length - 1))
  return withCursorVisible({ ...state, patchIndex: index, cursor, top })
}

export const openedAt = (state: TuiState, patchIndex: number, line: number): TuiState => {
  const landed = { ...state, patchIndex, stop: 0, anchorRow: 0, selecting: false }
  const shown = selectedPatch(landed)
  if (shown === undefined) return { ...landed, cursor: 0, top: 0 }
  const cursor = rowShowing(shown, line) ?? rowAtSourceLine(shown, line)
  const height = Math.max(1, landed.viewport)
  const room = Math.max(0, shown.rows.length - height)
  return withCursorVisible({
    ...landed,
    cursor,
    top: clamp(cursor - Math.floor(height / 2), 0, room),
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

const inserted = (state: TuiState, text: string): TuiState => {
  const at = caretAt(state)
  return {
    ...state,
    draft: `${state.draft.slice(0, at)}${text}${state.draft.slice(at)}`,
    caret: at + text.length,
  }
}

export const typed = (state: TuiState, character: string): TuiState =>
  state.screen === "palette"
    ? { ...state, query: `${state.query}${character}`, paletteIndex: 0 }
    : inserted(state, character)

const TAB_WIDTH = 2

const SPACE_CODE = 0x20
const ERASED_FROM = 0x7f
const ERASED_TO = 0x9f

const readable = (character: string): boolean => {
  if (character === "\n") return true
  const code = character.codePointAt(0) ?? 0
  return code >= SPACE_CODE && (code < ERASED_FROM || code > ERASED_TO)
}

const legible = (text: string): string =>
  Array.from(text.replace(/\r\n?/g, "\n").replace(/\t/g, " ".repeat(TAB_WIDTH)))
    .filter(readable)
    .join("")

export const pasted = (state: TuiState, text: string): TuiState => {
  const clean = legible(stripAnsiSequences(text))
  if (clean.length === 0) return state
  return typed(state, state.screen === "palette" ? clean.replace(/\n/g, " ") : clean)
}

export const backspaced = (state: TuiState): TuiState => {
  if (state.screen === "palette") {
    return { ...state, query: state.query.slice(0, -1), paletteIndex: 0 }
  }
  const at = caretAt(state)
  if (at === 0) return state
  return { ...state, draft: `${state.draft.slice(0, at - 1)}${state.draft.slice(at)}`, caret: at - 1 }
}

const cutBackTo = (state: TuiState, to: number): TuiState => {
  const at = caretAt(state)
  if (to >= at) return state
  return { ...state, draft: `${state.draft.slice(0, to)}${state.draft.slice(at)}`, caret: to }
}

export const wordBackspaced = (state: TuiState): TuiState =>
  state.screen === "palette" ? backspaced(state) : cutBackTo(state, caretByWord(state, -1))

export const lineBackspaced = (state: TuiState): TuiState =>
  state.screen === "palette" ? backspaced(state) : cutBackTo(state, caretToEdge(state, "start"))

export const deleted = (state: TuiState): TuiState => {
  const at = caretAt(state)
  if (at >= state.draft.length) return state
  return { ...state, draft: `${state.draft.slice(0, at)}${state.draft.slice(at + 1)}`, caret: at }
}

export const caretMoved = (state: TuiState, delta: number): TuiState => ({
  ...state,
  caret: clamp(caretAt(state) + delta, 0, state.draft.length),
})

export const caretJumped = (state: TuiState, delta: number): TuiState => ({
  ...state,
  caret: caretByWord(state, delta),
})

export const caretHomed = (state: TuiState, edge: "start" | "end"): TuiState => ({
  ...state,
  caret: caretToEdge(state, edge),
})

export const withDraft = (state: TuiState, draft: string): TuiState => ({
  ...state,
  draft,
  caret: draft.length,
})

export const paletteMoved = (state: TuiState, delta: number): TuiState => movePalette(state, delta)

export const paletteClosed = (state: TuiState): TuiState => ({
  ...state,
  screen: state.returnTo,
  query: "",
})

export const withWaiting = (state: TuiState, waiting: string): TuiState => ({
  ...state,
  waiting,
})

export const withMatches = (state: TuiState, matches: TuiState["matches"], term: string): TuiState => ({
  ...state,
  screen: "search",
  matches,
  matchIndex: 0,
  term,
  selecting: false,
})

export const withNoticeHere = (state: TuiState, notice: string): TuiState => ({
  ...state,
  notice,
})

export const withNotice = (state: TuiState, notice: string): TuiState => ({
  ...state,
  screen: "review",
  draft: "",
  caret: 0,
  selecting: false,
  notice,
})
