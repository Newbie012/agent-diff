import { Option } from "effect"
import { anchorFor, type Patch, type Row } from "../domain/patch/index.ts"
import { type Action } from "./command.ts"
import { gapNumbered, gapRowSet, shownOf } from "./gaps.ts"
import { searchCommands, searchGlossary } from "./match.ts"
import { preferences } from "../domain/preferences/index.ts"
import {
  crowdedOf,
  carriesLine,
  foldersOfFile,
  openingRow,
  fileOrder,
  changeAround,
  hunkStarts,
  onLayers,
  selectedPatch,
  shownMatches,
  selectionRange,
  layerAfter,
  layerFile,
  layerHolding,
  placeIn,
  readingOrder,
  type Screen,
  type TuiState,
  needingRowsIn,
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
  chosenNow,
  refsShown,
  treeRows,
  withChosen,
  treeStart,
  panelEntry,
} from "./model.ts"

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value))

const lastRow = (patch: Patch | undefined): number => Math.max(0, (patch?.rows.length ?? 1) - 1)

const rowsIn = (state: TuiState): number => selectedPatch(state)?.rows.length ?? 0

const withCursorVisible = (given: TuiState): TuiState => {
  const state = given.picked === undefined ? given : { ...given, picked: undefined }
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

export const restingOn = (state: TuiState, row: number): TuiState => ({
  ...state,
  picked: undefined,
  selecting: false,
  stop: 0,
  anchorRow: clamp(row, 0, lastRow(selectedPatch(state))),
  cursor: clamp(row, 0, lastRow(selectedPatch(state))),
})

export const draggedTo = (state: TuiState, from: number, to: number): TuiState => ({
  ...state,
  picked: undefined,
  selecting: true,
  anchorRow: clamp(from, 0, lastRow(selectedPatch(state))),
  cursor: clamp(to, 0, lastRow(selectedPatch(state))),
})

export const pickedIn = (
  state: TuiState,
  row: number,
  from: number,
  to: number,
): TuiState => ({
  ...state,
  selecting: false,
  anchorRow: clamp(row, 0, lastRow(selectedPatch(state))),
  cursor: clamp(row, 0, lastRow(selectedPatch(state))),
  picked: { row, from: Math.min(from, to), to: Math.max(from, to) },
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
  const rows = needingRowsIn(moved, file)
  const landing = delta > 0 ? rows[0] : rows.at(-1)
  return landing === undefined ? moved : atRow(moved, landing)
}

const nothingOpen = (state: TuiState): TuiState => {
  const any = needingRowsIn(state, state.patchIndex).length > 0
  return withNotice(state, any ? "nothing else waiting on you here" : "nothing waiting on you here")
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

const moveLayer = (state: TuiState, delta: number): TuiState => {
  const order = readingOrder(state)
  if (order.length === 0) return state
  const at = placeIn(state)
  const landed = order[clamp((at === -1 ? 0 : at) + delta, 0, order.length - 1)]
  if (landed === undefined) return state
  return {
    ...state,
    layerIndex: landed.layer,
    openLayers: state.openLayers.includes(landed.layer)
      ? state.openLayers
      : [...state.openLayers, landed.layer],
    patchIndex: landed.file,
    railScroll: -1,
    top: 0,
    cursor: landingOn({ ...state, layerIndex: landed.layer }, landed.file),
    anchorRow: 0,
    selecting: false,
  }
}

const inRail = (state: TuiState, delta: number): TuiState =>
  onLayers(state) ? moveLayer(state, delta) : moveFile(state, delta)

export const railScrolled = (state: TuiState, delta: number): TuiState => {
  if (onLayers(state)) return inRail(state, delta)
  const height = Math.max(1, state.railRows)
  const rows = treeRows(state).length
  if (rows <= height) return state
  const start = treeStart(state, height)
  return { ...state, railScroll: clamp(start + delta, 0, rows - height) }
}

const movePanel = (state: TuiState, delta: number): TuiState => ({
  ...state,
  panelIndex: clamp(state.panelIndex + delta, 0, Math.max(0, panelEntries(state).length - 1)),
})

const layerDown = (state: TuiState, delta: number): TuiState => {
  if (state.focus === "tree") return inRail(state, delta)
  if (state.focus === "review") return movePanel(state, delta)
  return stepStop(state, delta)
}

const stepsToEnd = (state: TuiState, delta: number): number => {
  const at = placeIn(state)
  const last = Math.max(0, readingOrder(state).length - 1)
  const here = at === -1 ? 0 : at
  return delta < 0 ? -here : last - here
}

const toTop = (state: TuiState): TuiState => ({
  ...atRow(state, landingOn(state, state.patchIndex)),
  top: 0,
  scroll: -1,
})

const farOff = (state: TuiState, delta: number): TuiState => {
  if (state.focus === "tree") {
    const steps = stepsToEnd(state, delta)
    return steps === 0 ? state : inRail(state, steps)
  }
  if (state.focus === "review") return movePanel(state, delta * PANEL_FAR)
  return delta < 0 ? toTop(state) : atRow(state, lastRow(selectedPatch(state)))
}

const byHalf = (state: TuiState, delta: number): TuiState => {
  const step = Math.max(1, Math.floor(state.viewport / 2))
  if (state.focus === "diff") return moveCursor(state, delta * step)
  const wanted = delta * step
  const bounded =
    state.focus === "tree" ? boundedStep(state, wanted) : wanted
  return bounded === 0 ? state : layerDown(state, bounded)
}

const boundedStep = (state: TuiState, wanted: number): number => {
  const most = stepsToEnd(state, wanted)
  return wanted < 0 ? Math.max(wanted, most) : Math.min(wanted, most)
}

const PANEL_FAR = 10_000

const PANES: ReadonlyArray<TuiState["focus"]> = ["tree", "diff", "review"]

const paneShown = (state: TuiState, pane: TuiState["focus"]): boolean => {
  if (pane === "review") return panelShown(state)
  if (pane === "tree") return state.navOpen
  return true
}

const panesShown = (state: TuiState): ReadonlyArray<TuiState["focus"]> =>
  PANES.filter((pane) => paneShown(state, pane))

const focusStepped = (state: TuiState, delta: number): TuiState["focus"] => {
  const shown = panesShown(state)
  const at = shown.indexOf(state.focus)
  const from = at === -1 ? 0 : at
  return shown[(from + delta + shown.length) % shown.length] ?? state.focus
}

const togglePanel = (state: TuiState): TuiState => {
  if (!panelFits(state)) {
    return withNotice(state, "the terminal is too narrow for the review panel")
  }
  if (state.panelOpen) {
    return {
      ...state,
      panelOpen: false,
      panelWas: false,
      focus: state.focus === "review" ? state.focusWas : state.focus,
      panelIndex: 0,
    }
  }
  const worthReading = panelEntries(state).length > 0
  return {
    ...state,
    panelOpen: true,
    panelWas: true,
    focus: worthReading ? "review" : state.focus,
    focusWas: state.focus,
    panelIndex: 0,
  }
}

const toggleNav = (state: TuiState): TuiState => {
  if (state.navOpen) {
    return {
      ...state,
      navOpen: false,
      focus: state.focus === "tree" ? "diff" : state.focus,
    }
  }
  return { ...state, navOpen: true }
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

const foldMoved = (state: TuiState, shut: boolean): TuiState =>
  shut
    ? { ...state, openMoved: false }
    : { ...state, openMoved: true, panelIndex: state.panelIndex + 1 }

const overFold = (state: TuiState): boolean =>
  state.focus === "review" && panelEntry(state)?.kind === "fold"

const readingThread = (state: TuiState): TuiState => ({
  ...state,
  screen: "thread",
  returnTo: state.screen,
})

const overThread = (state: TuiState): boolean =>
  state.focus === "review" && panelEntry(state) !== undefined

const fold = (state: TuiState, shut: boolean): TuiState => {
  if (overFold(state)) return foldMoved(state, shut)
  if (!shut && overThread(state)) return readingThread(state)
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

const landingOn = (state: TuiState, patchIndex: number): number => {
  const held = { ...state, patchIndex }
  const drawn = shownOf(held)
  if (drawn === undefined) return openingRow(state, patchIndex)
  const hidden = gapRowSet(drawn)
  const shows = (row: Row): boolean => !hidden.has(row.index) && carriesLine(row)
  const changed = onLayers(held)
    ? drawn.patch.rows.findIndex((row) => shows(row) && row.kind !== "context")
    : -1
  if (changed !== -1) return changed
  const at = drawn.patch.rows.findIndex(shows)
  return at === -1 ? openingRow(state, patchIndex) : at
}

const revealing = (state: TuiState, patchIndex: number): ReadonlyArray<string> => {
  const wanted = foldersOfFile({ ...state, patchIndex }, patchIndex)
  return state.closed.filter((path) => !wanted.includes(path))
}

const atTheEnd = (state: TuiState, delta: number): boolean => {
  const at = placeIn(state)
  const wanted = at + delta
  return at !== -1 && (wanted < 0 || wanted >= readingOrder(state).length)
}

const moveFile = (state: TuiState, delta: number): TuiState => {
  if (atTheEnd(state, delta)) {
    return withNoticeHere(state, delta > 0 ? "last file" : "first file")
  }
  const next = layerFile(state, delta)
  const layer = onLayers(state) ? layerAfter(state, delta) : state.layerIndex
  return {
    ...state,
    notice: "",
    layerIndex: layer,
    openLayers: state.openLayers.includes(layer)
      ? state.openLayers
      : [...state.openLayers, layer],
    closed: revealing(state, next),
    patchIndex: next,
    top: 0,
    cursor: landingOn({ ...state, layerIndex: layer }, next),
    anchorRow: 0,
    selecting: false,
  }
}

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

export const grownBy = (state: TuiState, delta: number): TuiState => {
  const held = state.selecting ? state : { ...state, selecting: true, anchorRow: state.cursor }
  return withCursorVisible({
    ...held,
    stop: 0,
    cursor: clamp(held.cursor + delta, 0, lastRow(selectedPatch(state))),
  })
}

const startSelection = (state: TuiState): TuiState => ({
  ...state,
  selecting: true,
  anchorRow: state.cursor,
})

const draftMark = (state: TuiState): string => {
  const [from, to] = selectionRange(state)
  return `${selectedPatch(state)?.path ?? ""}:${from}-${to}`
}

const openCompose = (state: TuiState): TuiState => {
  const patch = selectedPatch(state)
  const [from, to] = selectionRange(state)
  const anchored = patch !== undefined && Option.isSome(anchorFor(patch, from, to))
  if (!anchored) return withNoticeHere(state, "no line here to comment on")
  const mark = draftMark(state)
  const kept = state.draftAt === mark ? state.draft : ""
  return {
    ...state,
    screen: "compose",
    draft: kept,
    draftAt: mark,
    replyTo: undefined,
    anchorRow: state.selecting ? state.anchorRow : state.cursor,
  }
}

const outOfDiff = (state: TuiState): TuiState =>
  state.selecting
    ? { ...state, selecting: false, anchorRow: state.cursor }
    : { ...state, screen: "branches", selecting: false }

const BACK_FROM: Partial<Record<Screen, (state: TuiState) => TuiState>> = {
  search: (state) => ({ ...state, screen: "review", matches: [], term: "", query: "" }),
  report: (state) => ({ ...state, screen: state.returnTo, draft: "" }),
  palette: (state) => ({ ...state, screen: state.returnTo, query: "" }),
  keys: (state) => ({ ...state, screen: state.returnTo, query: "" }),
  settings: (state) => ({ ...state, screen: state.returnTo }),
  thread: (state) => ({ ...state, screen: state.returnTo }),
  compose: (state) => ({ ...state, screen: "review", replyTo: undefined }),
}

const goBack = (state: TuiState): TuiState =>
  BACK_FROM[state.screen]?.(state) ?? outOfDiff(state)

const walkMatches = (state: TuiState, delta: number): TuiState => ({
  ...state,
  matchIndex: clamp(state.matchIndex + delta, 0, Math.max(0, shownMatches(state).length - 1)),
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

const openSettings = (state: TuiState): TuiState => ({
  ...state,
  screen: "settings",
  returnTo: state.screen,
  settingsIndex: 0,
})

const moveSettings = (state: TuiState, delta: number): TuiState => ({
  ...state,
  settingsIndex: clamp(state.settingsIndex + delta, 0, Math.max(0, preferences.length - 1)),
})

const flipSetting = (state: TuiState): TuiState => {
  const wanted = preferences[state.settingsIndex]
  if (wanted === undefined) return state
  const held = chosenNow(state)
  return withChosen(state, wanted.name, !(held[wanted.name] ?? wanted.byDefault))
}

const moveRef = (state: TuiState, delta: number): TuiState => ({
  ...state,
  refIndex: clamp(state.refIndex + delta, 0, Math.max(0, refsShown(state).length - 1)),
})

export const withChoices = (
  state: TuiState,
  refs: ReadonlyArray<string>,
  screen: "base" | "editor",
  now = "",
): TuiState => ({
  ...state,
  screen,
  editorNow: now,
  returnTo: state.screen,
  refs,
  refIndex: 0,
  query: "",
})

export const withRefs = (state: TuiState, refs: ReadonlyArray<string>): TuiState =>
  withChoices(state, refs, "base")

const movePalette = (state: TuiState, delta: number): TuiState => ({
  ...state,
  paletteIndex: clamp(state.paletteIndex + delta, 0, Math.max(0, offered(state).length - 1)),
})

export const paletteMatches = (state: TuiState) => searchCommands(state.returnTo, state.query)

export const keyMatches = (state: TuiState) =>
  searchGlossary(state.returnTo, state.query)

export const offered = (state: TuiState) =>
  state.screen === "keys" ? keyMatches(state) : paletteMatches(state)

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
  "cursor.top": (state) => farOff(state, -1),
  "cursor.bottom": (state) => farOff(state, 1),
  "cursor.pageDown": (state) => byHalf(state, 1),
  "cursor.pageUp": (state) => byHalf(state, -1),
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
  "select.grow": (state) => grownBy(state, 1),
  "select.shrink": (state) => grownBy(state, -1),
  "select.hunk": selectHunk,
  "select.swap": swapEnds,
  "compose.open": openCompose,
  "compose.submit": (state) => state,
  "held.send": (state) => state,
  "thread.reply": (state) => state,
  "remark.accept": (state) => state,
  "focus.toggle": (state) => ({ ...state, focus: focusStepped(state, 1) }),
  "focus.back": (state) => ({ ...state, focus: focusStepped(state, -1) }),
  "panel.toggle": togglePanel,
  "nav.toggle": toggleNav,
  "nav.zoom": zoom,
  "wrap.toggle": (state) => ({ ...state, wrap: !state.wrap, pan: 0 }),
  "sticky.toggle": (state) => ({ ...state, sticky: !state.sticky }),
  "pan.right": (state) => panned(state, PAN_STEP),
  "pan.left": (state) => panned(state, -PAN_STEP),
  "review.reload": (state) => state,
  "base.open": (state) => state,
  "base.set": (state) => state,
  "base.clear": (state) => state,
  "base.next": (state) => moveRef(state, 1),
  "base.prev": (state) => moveRef(state, -1),
  "line.open": (state) => state,
  "editor.open": (state) => state,
  "thread.settle": (state) => state,
  "thread.settleRead": (state) => state,
  "thread.remove": (state) => state,
  "report.mode": (state) => ({ ...state, reportFull: !state.reportFull }),
  "panel.flip": (state) => ({ ...state, newestFirst: !state.newestFirst, panelIndex: 0 }),
  "tree.winnow": (state) => ({ ...state, hideReviewed: !state.hideReviewed }),
  "panel.winnow": (state) => ({
    ...state,
    hideSettled: !state.hideSettled,
    panelIndex: 0,
  }),
  "rail.toggle": toggleRail,
  "layers.ask": (state) => state,
  "file.vouch": (state) => state,
  "file.vouch.next": (state) => state,
  "tree.collapse": (state) => fold(state, true),
  "tree.expand": (state) => fold(state, false),
  "report.open": (state) => ({
    ...state,
    screen: "report",
    draft: "",
    returnTo: state.screen,
  }),
  "report.send": (state) => state,
  "palette.open": openPalette,
  "keys.open": openKeys,
  "settings.open": openSettings,
  "settings.next": (state) => moveSettings(state, 1),
  "settings.prev": (state) => moveSettings(state, -1),
  "settings.flip": flipSetting,
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

export const resumedAt = (
  state: TuiState,
  patchIndex: number,
  cursor: number,
  top: number,
): TuiState => {
  const held = { ...state, patchIndex }
  const rows = shownOf(held)
  const hidden = rows === undefined ? new Set<number>() : gapRowSet(rows)
  const row = state.patches[patchIndex]?.rows[cursor]
  const workable = row !== undefined && carriesLine(row) && !hidden.has(cursor)
  return {
    ...state,
    patchIndex,
    top,
    cursor: workable ? cursor : landingOn(state, patchIndex),
  }
}

export const atFile = (state: TuiState, patchIndex: number): TuiState => ({
  ...state,
  closed: revealing(state, patchIndex),
  patchIndex,
  cursor: landingOn(state, patchIndex),
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

export const allRevealed = (state: TuiState): TuiState["revealed"] => {
  const path = selectedPatch(state)?.path
  if (path === undefined) return state.revealed
  const here = (shownOf(state)?.gaps ?? []).map((gap) => ({ file: path, gap: gap.index, lines: gap.hidden }))
  const others = state.revealed.filter((entry) => entry.file !== path)
  return [...others, ...here]
}

const revealsAfter = (state: TuiState, gap: number, lines: number): TuiState["revealed"] => {
  const path = state.patches[state.patchIndex]?.path ?? ""
  const others = state.revealed.filter((entry) => entry.file !== path || entry.gap !== gap)
  return lines <= 0 ? others : [...others, { file: path, gap, lines }]
}

export const gapShown = (state: TuiState, gap: number, lines: number): TuiState => ({
  ...state,
  revealed: revealsAfter(state, gap, lines),
})

export const gapOpened = (state: TuiState, gap: number, delta: number): TuiState => {
  const path = state.patches[state.patchIndex]?.path ?? ""
  const now = state.revealed.find((entry) => entry.file === path && entry.gap === gap)?.lines ?? 0
  const opened = { ...state, revealed: revealsAfter(state, gap, now + delta) }
  const wanted = gapNumbered(opened, gap)?.row ?? state.cursor
  const landed = clamp(wanted, 0, lastRow(selectedPatch(opened)))
  return withCursorVisible({ ...opened, cursor: landed, anchorRow: landed, selecting: false })
}

export const panBy = (state: TuiState, delta: number): TuiState =>
  state.wrap ? state : { ...state, pan: Math.max(0, state.pan + delta) }

export const withRemarks = (state: TuiState, remarks: TuiState["remarks"]): TuiState => ({
  ...state,
  remarks,
})

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

const laidOver = (
  state: TuiState,
  told: { layers: TuiState["layers"]; stale: boolean; summary?: string },
  anew: boolean,
): TuiState => ({
  ...state,
  layers: told.layers,
  layersStale: told.stale,
  summary: told.summary ?? "",
  layerIndex: anew ? 0 : Math.min(state.layerIndex, Math.max(0, told.layers.length - 1)),
  openLayers: anew
    ? told.layers.map((_, at) => at)
    : state.openLayers.filter((at) => at < told.layers.length),
  rail: told.layers.length === 0 ? "tree" : anew ? "layers" : state.rail,
})

const onLayerHolding = (state: TuiState): TuiState => {
  if (!onLayers(state)) return state
  const layer = layerHolding(state, state.patchIndex)
  return {
    ...state,
    layerIndex: layer,
    openLayers: state.openLayers.includes(layer)
      ? state.openLayers
      : [...state.openLayers, layer],
  }
}

export const withLayers = (
  state: TuiState,
  told: { layers: TuiState["layers"]; stale: boolean; summary?: string },
): TuiState => {
  const layers = told.layers
  const anew = state.layers.length === 0
  const opened = laidOver(state, told, anew)
  if (layers.length === 0) return opened
  if (!anew) return onLayerHolding(opened)
  const first = readingOrder(opened)[0]
  if (first === undefined) return opened
  return { ...opened, layerIndex: first.layer, patchIndex: first.file, cursor: 0, top: 0 }
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

export const withVouched = (
  state: TuiState,
  vouched: ReadonlyArray<string>,
  parts?: ReadonlyArray<string>,
): TuiState => ({
  ...state,
  vouched,
  partsRead: parts ?? state.partsRead,
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
  return withCursorVisible(onLayerHolding({ ...state, patchIndex: index, cursor, top }))
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

export const withPatches = (state: TuiState, patches: ReadonlyArray<Patch>): TuiState => {
  const crowded = crowdedOf(patches)
  const opened = { ...state, patches, closed: crowded }
  const patchIndex = fileOrder(opened)[0] ?? 0
  const closed = revealing(opened, patchIndex)
  return {
    ...state,
    screen: "review",
    patches,
    full: [],
    revealed: [],
    closed,
    patchIndex,
    cursor: landingOn(opened, patchIndex),
    anchorRow: 0,
    selecting: false,
  }
}

const TAB_WIDTH = 2

const SPACE_CODE = 0x20
const ERASED_FROM = 0x7f
const ERASED_TO = 0x9f

const readable = (character: string): boolean => {
  if (character === "\n") return true
  const code = character.codePointAt(0) ?? 0
  return code >= SPACE_CODE && (code < ERASED_FROM || code > ERASED_TO)
}

export const legible = (text: string): string =>
  Array.from(text.replace(/\r\n?/g, "\n").replace(/\t/g, " ".repeat(TAB_WIDTH)))
    .filter(readable)
    .join("")

export const withDraft = (state: TuiState, draft: string): TuiState => ({
  ...state,
  draft,
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

export const withFinder = (state: TuiState, seed: string): TuiState => ({
  ...state,
  screen: "search",
  matches: [],
  matchIndex: 0,
  term: "",
  query: seed,
  selecting: false,
})

export const withMatches = (
  state: TuiState,
  found: {
    readonly matches: TuiState["matches"]
    readonly counted: TuiState["counted"]
    readonly left: number
  },
  term: string,
): TuiState => ({
  ...state,
  screen: "search",
  matches: found.matches,
  counted: found.counted,
  leftOut: found.left,
  around: [],
  matchIndex: 0,
  term,
  selecting: false,
})

export const withAround = (state: TuiState, around: ReadonlyArray<string>): TuiState => ({
  ...state,
  around,
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
