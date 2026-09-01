import { Option } from "effect"
import { WHOLE_FILE } from "../domain/patch/index.ts"
import { preferences } from "../domain/preferences/index.ts"
import { partOf } from "../domain/review/index.ts"
import { REMAINDER_TITLE } from "../domain/layers/index.ts"

export type Focus = "tree" | "diff" | "review"

export type StagedComment = {
  readonly id?: string
  readonly at?: string
  readonly file: string
  readonly side: "old" | "new"
  readonly start: number
  readonly end: number
  readonly body: string
  readonly snippet?: string
  readonly settled?: boolean
  readonly removed?: boolean
  readonly outside?: boolean
  readonly stale?: boolean
  readonly asks?: boolean
  readonly answers?: ReadonlyArray<string>
  readonly turns?: ReadonlyArray<{ readonly voice: "reviewer" | "agent"; readonly body: string }>
  readonly unread?: number
  readonly takenAt?: string
  readonly remark?: string
  readonly layer?: string
}
import { anchorFor, type Patch } from "../domain/patch/index.ts"
import { gapRowSet, shownOf, type Reveal } from "./gaps.ts"
import type { ThreadStand } from "./marks.ts"
import { buildTree, crowdedDirectories, flattenTree, type Tree, type TreeRow } from "./tree.ts"
import type { BranchSummary, Match, Remark, ReportedLayer } from "../cli/index.ts"
import type { Counted } from "../domain/search/index.ts"
import type { ProseAnchor } from "../domain/layers/index.ts"

export type LayerRow = {
  readonly index: number
  readonly kind: "title" | "dir" | "file" | "gap" | "count" | "note"
  readonly text: string
  readonly lead: boolean
  readonly fileIndex?: number
  readonly reviewed?: boolean
  readonly here?: boolean
}

export type Spot = { readonly row: number; readonly column: number }

export type Clicked = {
  readonly pane: Focus
  readonly file?: number | undefined
  readonly layer?: number | undefined
  readonly entry?: number | undefined
}

export type Picked = {
  readonly row: number
  readonly from: number
  readonly to: number
}

export type Screen =
  | "branches"
  | "review"
  | "compose"
  | "palette"
  | "report"
  | "search"
  | "keys"
  | "settings"
  | "base"
  | "editor"
  | "thread"

const HOLDS: Readonly<Record<string, keyof TuiState>> = {
  wrap: "wrap",
  sticky: "sticky",
  panel: "panelOpen",
  hideReviewed: "hideReviewed",
  hideSettled: "hideSettled",
  newestFirst: "newestFirst",
  remarks: "remarksOn",
  hold: "hold",
}

export const chosenNow = (state: TuiState): Readonly<Record<string, boolean>> =>
  Object.fromEntries(
    Object.entries(HOLDS).map(([name, held]) => [name, state[held] === true]),
  )

export const withChosen = (state: TuiState, name: string, value: boolean): TuiState => {
  const held = HOLDS[name]
  return held === undefined ? state : { ...state, [held]: value }
}

export type PreferenceRow = {
  readonly name: string
  readonly title: string
  readonly about: string
  readonly on: boolean
  readonly here: boolean
}

export const preferenceRows = (state: TuiState): ReadonlyArray<PreferenceRow> => {
  const held = chosenNow(state)
  return preferences.map((one, at) => ({
    name: one.name,
    title: one.title,
    about: one.about,
    on: held[one.name] ?? one.byDefault,
    here: at === state.settingsIndex,
  }))
}

export type ForgeAnswer = "asking" | "answered" | "silent"

export type TuiState = {
  readonly screen: Screen
  readonly branches: ReadonlyArray<BranchSummary>
  readonly branchIndex: number
  readonly patches: ReadonlyArray<Patch>
  readonly patchIndex: number
  readonly cursor: number
  readonly stop: number
  readonly opened: ReadonlyArray<string>
  readonly replyTo?: string | undefined
  readonly answerTo?: string | undefined
  readonly anchorRow: number
  readonly selecting: boolean
  readonly draft: string
  readonly draftAt: string
  readonly notice: string
  readonly waiting: string
  readonly query: string
  readonly paletteIndex: number
  readonly returnTo: Screen
  readonly closed: ReadonlyArray<string>
  readonly vouched: ReadonlyArray<string>
  readonly partsRead: ReadonlyArray<string>
  readonly openMoved: boolean
  readonly refSaid: Readonly<Record<string, string>>
  readonly sent: ReadonlyArray<StagedComment>
  readonly remarks: ReadonlyArray<Remark>
  readonly held: ReadonlyArray<StagedComment>
  readonly viewport: number
  readonly context: number
  readonly contextWas: number
  readonly top: number
  readonly source: ReadonlyArray<string>
  readonly full: ReadonlyArray<Patch>
  readonly revealed: ReadonlyArray<Reveal>
  readonly focus: Focus
  readonly navOpen: boolean
  readonly wrap: boolean
  readonly sticky: boolean
  readonly pan: number
  readonly layers: ReadonlyArray<ReportedLayer>
  readonly layersStale: boolean
  readonly summary: string
  readonly pulls: Readonly<Record<string, string>>
  readonly forge: ForgeAnswer
  readonly layerIndex: number
  readonly openLayers: ReadonlyArray<number>
  readonly rail: "tree" | "layers"
  readonly term: string
  readonly matches: ReadonlyArray<Match>
  readonly refs: ReadonlyArray<string>
  readonly refIndex: number
  readonly editorNow: string
  readonly counted: Counted
  readonly leftOut: number
  readonly around: ReadonlyArray<string>
  readonly matchIndex: number
  readonly arrived: ReadonlyArray<StagedComment>
  readonly panelOpen: boolean
  readonly panelWas: boolean
  readonly panelIndex: number
  readonly columns: number
  readonly reportFull: boolean
  readonly hideReviewed: boolean
  readonly hideSettled: boolean
  readonly picked: Picked | undefined
  readonly newestFirst: boolean
  readonly remarksOn: boolean
  readonly hold: boolean
  readonly tallest: number
  readonly scroll: number
  readonly railRows: number
  readonly railScroll: number
  readonly settingsIndex: number
  readonly now: number
  readonly focusWas: Focus
}

const nothingReviewed = {
  held: [] as ReadonlyArray<StagedComment>,
  arrived: [] as ReadonlyArray<StagedComment>,
  panelOpen: true,
  panelWas: true,
  panelIndex: 0,
  columns: 0,
  reportFull: true,
  hideReviewed: false,
  hideSettled: false,
  picked: undefined,
  newestFirst: true,
  remarksOn: false,
  hold: false,
  tallest: 0,
  scroll: -1,
  railRows: 12,
  railScroll: -1,
  settingsIndex: 0,
  now: 0,
  focusWas: "diff" as Focus,
}

const nothingFound = {
  matches: [] as ReadonlyArray<Match>,
  refs: [] as ReadonlyArray<string>,
  refIndex: 0,
  editorNow: "",
  matchIndex: 0,
  term: "",
  query: "",
  paletteIndex: 0,
}

export const initialState = (branches: ReadonlyArray<BranchSummary>): TuiState => ({
  ...nothingReviewed,
  screen: "branches",
  branches,
  branchIndex: 0,
  patches: [],
  patchIndex: 0,
  cursor: 0,
  stop: 0,
  opened: [],
  anchorRow: 0,
  selecting: false,
  draft: "",
  draftAt: "",
  notice: "",
  waiting: "",
  returnTo: "branches",
  closed: [],
  vouched: [],
  partsRead: [],
  openMoved: false,
  refSaid: {},
  sent: [],
  remarks: [],
  viewport: 20,
  context: 3,
  contextWas: 3,
  top: 0,
  source: [],
  full: [],
  revealed: [],
  focus: "diff",
  navOpen: true,
  wrap: false,
  sticky: true,
  pan: 0,
  layers: [],
  layersStale: false,
  summary: "",
  pulls: {},
  forge: "asking",
  layerIndex: 0,
  openLayers: [],
  ...nothingFound,
  counted: { file: 0, branch: 0, worktree: 0 },
  leftOut: 0,
  around: [],
  rail: "tree",
})

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

export const onLayers = (state: TuiState): boolean =>
  state.rail === "layers" && state.layers.length > 0

const selectedLayer = (state: TuiState): ReportedLayer | undefined => state.layers[state.layerIndex]

export const proseFor = (state: TuiState, path: string): ReadonlyArray<ProseAnchor> => {
  if (!onLayers(state)) return []
  const layer = selectedLayer(state)
  if (layer === undefined) return []
  return layer.prose.filter((anchor) => anchor.path === path)
}

const kept = (state: TuiState, at: number): boolean =>
  !state.hideReviewed || at === state.patchIndex || !isReviewed(state, at)

const layerHolds = (state: TuiState, layerIndex: number): ReadonlyArray<number> => {
  const layer = state.layers[layerIndex]
  if (layer === undefined) return []
  return layer.files.flatMap((path) => {
    const at = state.patches.findIndex((patch) => patch.path === path)
    return at === -1 ? [] : [at]
  })
}

export const layerFiles = (state: TuiState, layerIndex: number): ReadonlyArray<number> =>
  layerHolds(state, layerIndex).filter((at) => kept(state, at))

export const layerHolding = (state: TuiState, fileIndex: number): number => {
  const path = state.patches[fileIndex]?.path
  const at = state.layers.findIndex((layer) => layer.files.includes(path ?? ""))
  return at === -1 ? state.layerIndex : at
}

export const layerOpen = (state: TuiState, layerIndex: number): boolean =>
  state.openLayers.includes(layerIndex)

const chunked = (word: string, room: number): ReadonlyArray<string> =>
  word.length <= room ? [word] : [word.slice(0, room), ...chunked(word.slice(room), room)]

const packed = (lines: ReadonlyArray<string>, word: string, room: number): ReadonlyArray<string> => {
  const last = lines.at(-1)
  if (last === undefined || last.length + 1 + word.length > room) return [...lines, word]
  return [...lines.slice(0, -1), `${last} ${word}`]
}

const shortened = (word: string, room: number): string =>
  word.length <= room ? word : `${word.slice(0, Math.max(1, room - 1))}\u2026`

const wordWrapped = (text: string, room: number): ReadonlyArray<string> => {
  const width = Math.max(1, room)
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => shortened(word, width))
    .reduce<ReadonlyArray<string>>((lines, word) => packed(lines, word, width), [])
}

export const wrapped = (text: string, room: number): ReadonlyArray<string> => {
  const width = Math.max(1, room)
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .flatMap((word) => chunked(word, width))
    .reduce<ReadonlyArray<string>>((lines, word) => packed(lines, word, width), [])
}

export const clip = (label: string, room: number): string =>
  label.length > room ? `${label.slice(0, Math.max(0, room - 1))}…` : label

const TITLE_ROWS = 2

const titleRows = (
  state: TuiState,
  layerIndex: number,
  room: number,
  marked: boolean,
): ReadonlyArray<LayerRow> => {
  const lines = wordWrapped(state.layers[layerIndex]?.title ?? "", room)
  const heldLines = lines.slice(0, TITLE_ROWS)
  const last = heldLines.at(-1) ?? ""
  const said =
    lines.length > TITLE_ROWS
      ? [...heldLines.slice(0, -1), clip(`${last} …`, room)]
      : heldLines
  return said.map((text, at) => ({
    index: layerIndex,
    kind: "title" as const,
    text,
    lead: at === 0,
    here: at === 0 && marked,
  }))
}

const shortDir = (dir: string, room: number): string => {
  const whole = `${dir}/`
  if (whole.length <= room) return whole
  const parts = dir.split("/")
  const last = parts.at(-1) ?? ""
  const shrunk = parts.length < 3 ? "" : `${parts[0] ?? ""}/…/${last}/`
  if (shrunk.length > 0 && shrunk.length <= room) return shrunk
  const tail = `…/${last}/`
  if (tail.length <= room) return tail
  return `${clip(last, Math.max(1, room - 1))}/`
}

const fileRow = (state: TuiState, layerIndex: number, at: number, room: number): LayerRow => {
  const path = state.patches[at]?.path ?? ""
  const name = path.split("/").at(-1) ?? path
  return {
    index: layerIndex,
    kind: "file",
    text: clip(name, room),
    lead: false,
    fileIndex: at,
    reviewed: readIn(state, layerIndex, at),
    here: at === state.patchIndex && layerIndex === state.layerIndex,
  }
}

const shownFiles = (state: TuiState, layerIndex: number): ReadonlyArray<number> =>
  layerFiles(state, layerIndex).filter(
    (at) => !(state.hideReviewed && isReviewed(state, at) && at !== state.patchIndex),
  )

const dirOf = (state: TuiState, at: number): string => {
  const parts = (state.patches[at]?.path ?? "").split("/")
  return parts.slice(0, -1).join("/")
}

const fileRows = (
  state: TuiState,
  layerIndex: number,
  room: { readonly dir: number; readonly file: number },
): ReadonlyArray<LayerRow> => {
  const rows: Array<LayerRow> = []
  let held: string | undefined
  for (const at of shownFiles(state, layerIndex)) {
    const dir = dirOf(state, at)
    if (dir !== held && dir.length > 0) {
      rows.push({ index: layerIndex, kind: "dir", text: shortDir(dir, room.dir), lead: false })
    }
    held = dir
    rows.push(fileRow(state, layerIndex, at, room.file))
  }
  return rows
}

export const layerRead = (state: TuiState, layerIndex: number): { done: number; all: number } => {
  const files = layerHolds(state, layerIndex)
  return { done: files.filter((at) => readIn(state, layerIndex, at)).length, all: files.length }
}

export const layerDone = (state: TuiState, layerIndex: number): boolean => {
  const read = layerRead(state, layerIndex)
  return read.all > 0 && read.done === read.all
}

export type LayerRoom = {
  readonly title: number
  readonly dir: number
  readonly file: number
}

const countRow = (state: TuiState, index: number, room: number): ReadonlyArray<LayerRow> => {
  const read = layerRead(state, index)
  if (read.all === 0) return []
  const one = read.all === 1 ? "file" : "files"
  const said = `${read.done} of ${read.all} ${one} read`
  return [{ index, kind: "count", text: clip(said, room), lead: false }]
}

const NOTHING_LEFT = "nothing in this diff"

const textRows = (
  index: number,
  text: string,
  room: number,
  kind: "count" | "note",
): ReadonlyArray<LayerRow> =>
  wrapped(text, room).map((line) => ({ index, kind, text: line, lead: false }))

const emptyRows = (state: TuiState, index: number, room: number): ReadonlyArray<LayerRow> => {
  const layer = state.layers[index]
  if (layer === undefined) return []
  const gone = layer.vanished
  const said = gone.length === 0 ? NOTHING_LEFT : `${NOTHING_LEFT}: ${gone.join(", ")}`
  return [...textRows(index, said, room, "count"), ...textRows(index, layer.note, room, "note")]
}

const layerBody = (
  state: TuiState,
  index: number,
  room: LayerRoom,
  shown: ReadonlySet<number>,
): ReadonlyArray<LayerRow> => {
  if (layerRead(state, index).all === 0) return emptyRows(state, index, room.file)
  if (!layerOpen(state, index) || !shown.has(index)) return countRow(state, index, room.file)
  const rows = fileRows(state, index, room)
  return rows.length > 0 ? rows : countRow(state, index, room.file)
}

const holdsCursor = (state: TuiState, index: number): boolean =>
  index === state.layerIndex && layerFiles(state, index).includes(state.patchIndex)

const layerCard = (
  state: TuiState,
  index: number,
  room: LayerRoom,
  shown: ReadonlySet<number>,
): ReadonlyArray<LayerRow> => {
  const body = layerBody(state, index, room, shown)
  const marked = holdsCursor(state, index) && !body.some((row) => row.here === true)
  return [...titleRows(state, index, room.title, marked), ...body]
}

export const layerRows = (
  state: TuiState,
  room: LayerRoom,
  shown: ReadonlySet<number>,
): ReadonlyArray<LayerRow> =>
  state.layers.flatMap((_, index) => [
    ...(index > 0 ? [{ index, kind: "gap" as const, text: "", lead: false }] : []),
    ...layerCard(state, index, room, shown),
  ])

const nearFirst = (state: TuiState): ReadonlyArray<number> =>
  state.layers
    .map((_, at) => at)
    .filter((at) => layerOpen(state, at))
    .toSorted((one, two) => Math.abs(one - state.layerIndex) - Math.abs(two - state.layerIndex))

export const layerFitted = (
  state: TuiState,
  room: LayerRoom,
  height: number,
): ReadonlyArray<LayerRow> => {
  const every = new Set(state.layers.map((_, at) => at))
  const whole = layerRows(state, room, every)
  if (whole.length <= height) return whole
  const shown = new Set<number>([state.layerIndex])
  for (const at of nearFirst(state)) {
    shown.add(at)
    if (layerRows(state, room, shown).length > height) shown.delete(at)
  }
  shown.add(state.layerIndex)
  return layerRows(state, room, shown)
}

export type RailWindow = {
  readonly rows: ReadonlyArray<LayerRow>
  readonly more: number
  readonly above: number
}

const restingAt = (
  rows: ReadonlyArray<LayerRow>,
  height: number,
  layerIndex: number,
): number => {
  const first = Math.max(0, rows.findIndex((row) => row.index === layerIndex))
  const block = rows.findLastIndex((row) => row.index === layerIndex) - first + 1
  return block >= height ? first : first - Math.floor((height - block) / 2)
}

export const railTop = (
  rows: ReadonlyArray<LayerRow>,
  height: number,
  layerIndex: number,
  scroll: number,
): number => {
  const wanted = scroll >= 0 ? scroll : restingAt(rows, height, layerIndex)
  return Math.max(0, Math.min(Math.max(0, rows.length - height), wanted))
}

const PANE_CHROME = 3

export const RAIL_STEP = 2
export const RAIL_GUTTER = 3
export const RAIL_TITLE_LEAD = RAIL_GUTTER + 1
export const RAIL_DIR_LEAD = RAIL_TITLE_LEAD + RAIL_STEP
export const RAIL_FILE_LEAD = RAIL_DIR_LEAD + RAIL_STEP

export const layerRoomIn = (state: TuiState): LayerRoom => {
  const whole = Math.max(8, treeWidth(state.columns) - PANE_CHROME)
  return {
    title: Math.max(4, whole - RAIL_TITLE_LEAD),
    dir: Math.max(4, whole - RAIL_DIR_LEAD),
    file: Math.max(4, whole - RAIL_FILE_LEAD),
  }
}

export const railRowsFor = (state: TuiState): ReadonlyArray<LayerRow> =>
  layerFitted(state, layerRoomIn(state), Math.max(1, state.railRows))

export const railWindow = (
  rows: ReadonlyArray<LayerRow>,
  height: number,
  layerIndex: number,
  scroll = -1,
): RailWindow => {
  if (rows.length <= height) return { rows, more: 0, above: 0 }
  const start = railTop(rows, height, layerIndex, scroll)
  const shown = rows.slice(start, start + height)
  const here = new Set(shown.map((row) => row.index))
  const seen = (from: ReadonlyArray<LayerRow>): number =>
    new Set(from.filter((row) => !here.has(row.index)).map((row) => row.index)).size
  return {
    rows: shown,
    more: seen(rows.slice(start + height)),
    above: seen(rows.slice(0, start)),
  }
}

export const selectedBranch = (state: TuiState): BranchSummary | undefined =>
  state.branches[state.branchIndex]

export const selectedPatch = (state: TuiState): Patch | undefined => shownOf(state)?.patch

export const pullHere = (state: TuiState): string =>
  state.pulls[selectedBranch(state)?.branch ?? ""] ?? ""

export const knownToHaveNoPull = (state: TuiState): boolean =>
  state.forge === "answered" && pullHere(state).length === 0

export const treeOf = (state: TuiState): Tree =>
  buildTree(state.patches.map((patch, at) => (kept(state, at) ? patch.path : "")))

export const reviewedCountIn = (state: TuiState): number =>
  state.patches.filter((_, at) => isReviewed(state, at)).length

const CROWDED = 8

export const treeRows = (state: TuiState): ReadonlyArray<TreeRow> => {
  const tree = treeOf(state)
  return flattenTree(tree, state.closed)
}

export const crowdedOf = (patches: TuiState["patches"]): ReadonlyArray<string> =>
  crowdedDirectories(buildTree(patches.map((patch) => patch.path)), CROWDED)

export const foldersOfFile = (state: TuiState, fileIndex: number): ReadonlyArray<string> => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return []
  const drawn = new Set(
    flattenTree(treeOf(state), [])
      .filter((row) => row.kind !== "file")
      .map((row) => row.path),
  )
  const segments = patch.path.split("/").slice(0, -1)
  return segments
    .map((_, at) => segments.slice(0, segments.length - at).join("/"))
    .filter((path) => drawn.has(path))
}

export const isReviewed = (state: TuiState, fileIndex: number): boolean => {
  const patch = state.patches[fileIndex]
  return patch !== undefined && state.vouched.includes(patch.path)
}

export const partHere = (
  state: TuiState,
  layerIndex: number,
  fileIndex: number,
): string | undefined => {
  const path = state.patches[fileIndex]?.path
  const layer = state.layers[layerIndex]
  if (path === undefined || layer === undefined) return undefined
  const spans = layer.spans.filter((span) => span.path === path)
  return spans.length === 0 ? undefined : partOf(path, spans)
}

export const layerOver = (
  state: TuiState,
  path: string,
  start: number,
  end: number,
): string | undefined => {
  if (state.layers.length === 0) return undefined
  const found = state.layers.find(
    (layer) =>
      layer.title !== REMAINDER_TITLE &&
      layer.spans.some((span) => span.path === path && span.start <= end && span.end >= start),
  )
  return found?.title
}

export const layersHolding = (state: TuiState, fileIndex: number): number =>
  state.layers.filter((layer) =>
    layer.spans.some((span) => span.path === state.patches[fileIndex]?.path),
  ).length

export const readIn = (state: TuiState, layerIndex: number, fileIndex: number): boolean => {
  if (isReviewed(state, fileIndex)) return true
  const part = partHere(state, layerIndex, fileIndex)
  return part !== undefined && state.partsRead.includes(part)
}

export const treeStart = (state: TuiState, height: number): number => {
  const rows = treeRows(state)
  if (rows.length <= height) return 0
  const last = rows.length - height
  if (state.railScroll >= 0) return Math.min(state.railScroll, last)
  const here = rows.findIndex((row) => row.fileIndex === state.patchIndex)
  const anchor = here === -1 ? 0 : here
  return Math.max(0, Math.min(last, anchor - Math.floor(height / 2)))
}

export const treeWindow = (
  state: TuiState,
  height: number,
): { readonly rows: ReadonlyArray<TreeRow>; readonly more: number } => {
  const rows = treeRows(state)
  if (rows.length <= height) return { rows, more: 0 }
  const start = treeStart(state, height)
  return { rows: rows.slice(start, start + height), more: rows.length - (start + height) }
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const sinceThen = (at: string, now = Date.now()): string => {
  const gap = now - Date.parse(at)
  if (!Number.isFinite(gap) || gap < MINUTE) return "just now"
  if (gap < HOUR) return `${Math.floor(gap / MINUTE)}m ago`
  if (gap < DAY) return `${Math.floor(gap / HOUR)}h ago`
  return `${Math.floor(gap / DAY)}d ago`
}

export const threadStand = (thread: StagedComment): ThreadStand => {
  if (thread.removed === true) return "gone"
  if (thread.settled === true) return "settled"
  if (thread.asks === true) return "asked"
  if (spokeLast(thread) === "agent" && answersIn(thread) > 0) return "answered"
  return thread.takenAt === undefined ? "filed" : "waiting"
}

const STAND_WEIGHT: Readonly<Record<ThreadStand, number>> = {
  gone: 0,
  settled: 1,
  filed: 2,
  waiting: 2,
  answered: 3,
  asked: 4,
}

const louder = (one: ThreadStand, other: ThreadStand): ThreadStand =>
  STAND_WEIGHT[one] > STAND_WEIGHT[other] ? one : other

export type OpenThreads = { readonly open: number; readonly stand: ThreadStand }

export const threadsOn = (state: TuiState, fileIndex: number): OpenThreads => {
  const patch = state.patches[fileIndex]
  const stands =
    patch === undefined
      ? []
      : state.sent
          .filter(
            (entry) =>
              entry.file === patch.path && entry.removed !== true && entry.settled !== true,
          )
          .map((entry) => threadStand(entry))
  return { open: stands.length, stand: stands.reduce(louder, "gone") }
}

export const hiddenLines = (state: TuiState): number =>
  shownOf(state)?.gaps.reduce((total, gap) => total + gap.hidden, 0) ?? 0

const rowsUnder = (patch: Patch, entry: StagedComment): ReadonlyArray<number> =>
  patch.rows
    .filter((row) =>
      Option.match(row.newLine, {
        onNone: () => false,
        onSome: (line) => line >= entry.start && line <= entry.end,
      }),
    )
    .map((row) => row.index)

export const markedStands = (state: TuiState): ReadonlyMap<number, ThreadStand> => {
  const patch = selectedPatch(state)
  const found = new Map<number, ThreadStand>()
  if (patch === undefined) return found
  const here = state.sent.filter(
    (entry) => entry.file === patch.path && entry.removed !== true && entry.outside !== true,
  )
  for (const entry of here) {
    const stand = threadStand(entry)
    for (const row of rowsUnder(patch, entry)) found.set(row, louder(stand, found.get(row) ?? "gone"))
  }
  return found
}

export const carriesLine = (row: Patch["rows"][number]): boolean =>
  Option.isSome(row.newLine) || Option.isSome(row.oldLine)

const selectedRows = (state: TuiState): ReadonlyArray<Patch["rows"][number]> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const [from, to] = selectionRange(state)
  return patch.rows.slice(from, to + 1).filter(carriesLine)
}

export const snippetOf = (state: TuiState, limit: number): ReadonlyArray<string> =>
  selectedRows(state)
    .slice(0, limit)
    .map((row) => `${lineOf(row).padStart(4)} ${row.text}`)

export const selectedLineCount = (state: TuiState): number => selectedRows(state).length

const lineOf = (row: Patch["rows"][number]): string =>
  Option.match(row.newLine, { onNone: () => "-", onSome: (line) => String(line) })

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

export const composeTarget = (state: TuiState): string => {
  const patch = selectedPatch(state)
  if (state.answerTo !== undefined) return answerTarget(state)
  if (state.replyTo !== undefined) return replyTarget(state)
  if (patch === undefined) return ""
  const [from, to] = selectionRange(state)
  const anchor = anchorFor(patch, from, to)
  const span = Option.match(anchor, {
    onNone: () => "",
    onSome: (found) => (found.start === found.end ? `${found.start}` : `${found.start}-${found.end}`),
  })
  return span === "" ? `Comment on ${patch.path}` : `Comment on ${patch.path}:${span}`
}

export const remarkAnswering = (state: TuiState): Remark | undefined =>
  state.answerTo === undefined
    ? undefined
    : state.remarks.find((one) => one.id === state.answerTo)

const answerTarget = (state: TuiState): string => {
  const remark = remarkAnswering(state)
  return remark === undefined
    ? "Reply on the pull request"
    : `Reply to @${remark.by} on the pull request, ${remark.file}:${remark.end}`
}

const replyTarget = (state: TuiState): string => {
  const thread = threadReplying(state)
  if (thread === undefined) return "Reply"
  const span = thread.start === thread.end ? `${thread.end}` : `${thread.start}-${thread.end}`
  return `Reply on ${thread.file}:${span}`
}

export const threadReplying = (state: TuiState): StagedComment | undefined =>
  state.replyTo === undefined
    ? undefined
    : state.sent.find((entry) => entry.id === state.replyTo)

const VOICES: Readonly<Record<"reviewer" | "agent", string>> = {
  reviewer: "you",
  agent: "the agent",
}

export const remarkQuote = (state: TuiState, room: number): ReadonlyArray<string> => {
  const remark = remarkAnswering(state)
  if (remark === undefined) return []
  const said = [{ by: remark.by, body: remark.body }, ...remark.replies]
  const saidBy = (turn: { readonly by: string; readonly body: string }): ReadonlyArray<string> => {
    const lines = wrapped(turn.body, Math.max(8, room - 4)).map((line) => `    ${line}`)
    return [`  @${turn.by}`, ...lines]
  }
  return said.flatMap(saidBy)
}

export const threadQuote = (state: TuiState, room: number): ReadonlyArray<string> => {
  const thread = threadReplying(state)
  if (thread === undefined) return []
  const spoken = (thread.answers ?? []).map((body) => ({ voice: "agent" as const, body }))
  const turns = thread.turns ?? [{ voice: "reviewer" as const, body: thread.body }, ...spoken]
  const saidBy = (turn: { voice: "reviewer" | "agent"; body: string }): ReadonlyArray<string> => {
    const lines = wrapped(turn.body, Math.max(8, room - 4)).map((line) => `    ${line}`)
    return [`  ${VOICES[turn.voice]}`, ...lines]
  }
  return turns.flatMap(saidBy)
}

export const pickedText = (state: TuiState): string | undefined => {
  const picked = state.picked
  const patch = selectedPatch(state)
  if (picked === undefined || patch === undefined) return undefined
  const text = patch.rows[picked.row]?.text
  if (text === undefined) return undefined
  const taken = text.slice(picked.from, picked.to)
  return taken.length === 0 ? undefined : taken
}

const takenRows = (state: TuiState): ReadonlyArray<Patch["rows"][number]> => {
  const shown = shownOf(state)
  if (shown === undefined) return []
  const [from, to] = selectionRange(state)
  const gaps = gapRowSet(shown)
  const rows = shown.patch.rows.slice(from, to + 1).filter((row) => !gaps.has(row.index))
  const onlyGone = rows.length > 0 && rows.every((row) => row.kind === "removed")
  return onlyGone ? rows : rows.filter((row) => row.kind !== "removed")
}

export const selectedLines = (state: TuiState): ReadonlyArray<string> =>
  takenRows(state).map((row) => row.text)

export const shownMatches = (state: TuiState): ReadonlyArray<Match> => {
  const wanted = state.query.trim().toLowerCase()
  if (wanted.length === 0) return state.matches
  return state.matches.filter((match) =>
    `${match.path}:${match.line} ${match.text}`.toLowerCase().includes(wanted),
  )
}

export const refSaidOf = (state: TuiState, ref: string): string => state.refSaid[ref] ?? ""

export const refsShown = (state: TuiState): ReadonlyArray<string> => {
  const wanted = state.query.trim().toLowerCase()
  const held = state.refs.filter((ref) =>
    `${ref} ${refSaidOf(state, ref)}`.toLowerCase().includes(wanted),
  )
  return wanted.length === 0 || held.some((ref) => ref.toLowerCase() === wanted)
    ? held
    : held.concat([state.query.trim()])
}

export const picking = (state: TuiState): boolean =>
  state.screen === "base" || state.screen === "editor"

export const refHere = (state: TuiState): string | undefined =>
  refsShown(state)[state.refIndex]

export const matchHere = (state: TuiState): Match | undefined =>
  shownMatches(state)[state.matchIndex]

export const selectionReadout = (state: TuiState): string => {
  const patch = selectedPatch(state)
  if (patch === undefined || !state.selecting) return ""
  const lines = selectedRows(state).length
  return `${patch.path}  ${lines} ${lines === 1 ? "line" : "lines"} selected`
}

export { WHOLE_FILE }

export const CONTEXT_STEPS: ReadonlyArray<number> = [3, 10, 25, 60, WHOLE_FILE]

const wholeFileOff = (state: TuiState): boolean => state.context < WHOLE_FILE

export const contextToggled = (state: TuiState): number =>
  wholeFileOff(state) ? WHOLE_FILE : state.contextWas

export const layerContext = (current: number, delta: number): number => {
  const at = CONTEXT_STEPS.indexOf(current)
  const next = Math.max(0, Math.min(CONTEXT_STEPS.length - 1, (at === -1 ? 0 : at) + delta))
  return CONTEXT_STEPS[next] ?? current
}

export const newLineAt = (state: TuiState, row: number): number | undefined => {
  const rows = selectedPatch(state)?.rows ?? []
  const ahead = rows.slice(row).find((candidate) => Option.isSome(candidate.newLine))
  if (ahead !== undefined) return Option.getOrUndefined(ahead.newLine)
  const behind = rows.slice(0, row).findLast((candidate) => Option.isSome(candidate.newLine))
  return behind === undefined ? undefined : Option.getOrUndefined(behind.newLine)
}

export const sourceLineAt = (state: TuiState, row: number): number | undefined => {
  const patch = selectedPatch(state)
  const found = patch?.rows[row]
  if (found === undefined) return undefined
  return Option.getOrUndefined(found.newLine) ?? Option.getOrUndefined(found.oldLine)
}

export const rowAtSourceLine = (patch: Patch, line: number): number => {
  const found = patch.rows.find((row) =>
    Option.match(row.newLine, { onNone: () => false, onSome: (value) => value >= line }),
  )
  return found?.index ?? 0
}

export const rowShowing = (patch: Patch, line: number): number | undefined =>
  patch.rows.find((row) =>
    Option.match(row.newLine, { onNone: () => false, onSome: (value) => value === line }),
  )?.index

const lineOnSide = (row: Patch["rows"][number], side: "old" | "new"): number | undefined =>
  Option.getOrUndefined(side === "old" ? row.oldLine : row.newLine)

export const needingRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> =>
  [...commentRowsIn(state, fileIndex), ...remarkRowsIn(state, fileIndex)].toSorted(
    (left, right) => left - right,
  )

export const commentRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> => {
  const patch =
    fileIndex === state.patchIndex ? selectedPatch(state) : state.patches[fileIndex]
  if (patch === undefined) return []
  const notes = state.sent.filter((entry) => entry.file === patch.path && entry.outside !== true)
  const rows = patch.rows.filter((row) =>
    notes.some((note) => lineOnSide(row, note.side) === note.end),
  )
  return rows.map((row) => row.index).toSorted((left, right) => left - right)
}

export const threadsAtRow = (state: TuiState, row: number): ReadonlyArray<StagedComment> => {
  const patch = selectedPatch(state)
  const here = patch?.rows[row]
  if (patch === undefined || here === undefined) return []
  return state.sent.filter(
    (entry) =>
      entry.file === patch.path &&
      entry.id !== undefined &&
      entry.removed !== true &&
      entry.outside !== true &&
      lineOnSide(here, entry.side) === entry.end,
  )
}

export const remarkShown = (remark: Remark): boolean =>
  remark.state === "waiting" && remark.placed

export const remarksAtRow = (state: TuiState, row: number): ReadonlyArray<Remark> => {
  const patch = selectedPatch(state)
  const here = patch?.rows[row]
  if (patch === undefined || here === undefined) return []
  return state.remarks.filter(
    (one) => one.file === patch.path && remarkShown(one) && lineOnSide(here, one.side) === one.end,
  )
}

export const remarkRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> => {
  const patch = fileIndex === state.patchIndex ? selectedPatch(state) : state.patches[fileIndex]
  if (patch === undefined) return []
  const here = state.remarks.filter((one) => one.file === patch.path && remarkShown(one))
  return patch.rows
    .filter((row) => here.some((one) => lineOnSide(row, one.side) === one.end))
    .map((row) => row.index)
}

export type Stop =
  | { readonly kind: "comment"; readonly comment: StagedComment }
  | { readonly kind: "remark"; readonly remark: Remark }

export const stopsIn = (state: TuiState, row: number): ReadonlyArray<Stop> => [
  ...threadsAtRow(state, row).map((comment): Stop => ({ kind: "comment", comment })),
  ...remarksAtRow(state, row).map((remark): Stop => ({ kind: "remark", remark })),
]

export const stopsAtRow = (state: TuiState, row: number): number => 1 + stopsIn(state, row).length

export const remarkAtStop = (state: TuiState): Remark | undefined => {
  if (state.stop === 0) return undefined
  const found = stopsIn(state, state.cursor)[state.stop - 1]
  return found?.kind === "remark" ? found.remark : undefined
}

export const remarkAtRow = (state: TuiState, row: number): Remark | undefined =>
  remarksAtRow(state, row)[0]

export type RemarkHere = { readonly remark: Remark; readonly dismissed: boolean }

const remarkInPanel = (state: TuiState): RemarkHere | undefined => {
  if (state.focus !== "review") return undefined
  const chosen = panelEntry(state)
  return chosen?.kind === "remark"
    ? { remark: chosen.remark, dismissed: chosen.section === "dismissed" }
    : undefined
}

const remarkInDiff = (state: TuiState, shy: boolean): Remark | undefined => {
  if (state.focus !== "diff") return undefined
  const standing = remarkAtStop(state)
  if (standing !== undefined) return standing
  if (state.stop > 0) return undefined
  if (shy && threadAtRow(state, state.cursor) !== undefined) return undefined
  return remarkAtRow(state, state.cursor)
}

export const remarkUnderCursor = (state: TuiState): RemarkHere | undefined => {
  const chosen = remarkInPanel(state)
  if (chosen !== undefined) return chosen
  const here = remarkInDiff(state, true)
  return here === undefined ? undefined : { remark: here, dismissed: false }
}

export const remarkToTakeOn = (state: TuiState): Remark | undefined =>
  remarkInPanel(state)?.remark ?? remarkInDiff(state, false)

export const remarkHere = (state: TuiState): Remark | undefined => remarkToTakeOn(state)

export const threadHere = (state: TuiState): StagedComment | undefined => {
  if (state.focus === "review") {
    const entry = panelEntry(state)
    return entry?.kind === "comment" ? entry.comment : undefined
  }
  return threadAtStop(state) ?? threadAtRow(state, state.cursor)
}

export const threadAtStop = (state: TuiState): StagedComment | undefined => {
  if (state.stop === 0) return undefined
  const found = stopsIn(state, state.cursor)[state.stop - 1]
  return found?.kind === "comment" ? found.comment : undefined
}

export const threadAtRow = (state: TuiState, row: number): StagedComment | undefined => {
  const patch = selectedPatch(state)
  const here = patch?.rows[row]
  if (patch === undefined || here === undefined) return undefined
  return state.sent.find(
    (entry) =>
      entry.file === patch.path &&
      entry.id !== undefined &&
      entry.removed !== true &&
      entry.outside !== true &&
      lineOnSide(here, entry.side) === entry.end,
  )
}

export const openCommentRows = (state: TuiState): ReadonlyArray<number> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const open = state.sent.filter(
    (entry) =>
      entry.file === patch.path &&
      entry.settled !== true &&
      entry.removed !== true &&
      entry.outside !== true,
  )
  return patch.rows
    .filter(
      (row) =>
        open.some((note) => lineOnSide(row, note.side) === note.end) ||
        state.remarks.some(
          (one) => one.file === patch.path && remarkShown(one) && lineOnSide(row, one.side) === one.end,
        ),
    )
    .map((row) => row.index)
}

export const filesWithComments = (state: TuiState): ReadonlyArray<number> =>
  state.patches.flatMap((patch, index) =>
    state.sent.some((entry) => entry.file === patch.path) ||
    state.remarks.some((one) => one.file === patch.path && remarkShown(one))
      ? [index]
      : [],
  )

const answerCount = (comments: ReadonlyArray<StagedComment>): number =>
  comments.reduce((total, entry) => total + (entry.answers?.length ?? 0), 0)

export type PanelSection =
  | "remarks"
  | "held"
  | "asked"
  | "filed"
  | "with"
  | "answered"
  | "movedOn"
  | "settled"
  | "removed"
  | "dismissed"

export const PANEL_SECTIONS: ReadonlyArray<PanelSection> = [
  "remarks",
  "held",
  "asked",
  "filed",
  "with",
  "answered",
  "movedOn",
  "settled",
  "removed",
  "dismissed",
]

export type PanelEntry =
  | {
      readonly kind: "comment"
      readonly section: PanelSection
      readonly comment: StagedComment
      readonly fresh: boolean
      readonly unread: number
    }
  | {
      readonly kind: "remark"
      readonly section: PanelSection
      readonly remark: Remark
    }
  | {
      readonly kind: "fold"
      readonly section: PanelSection
      readonly held: number
      readonly open: boolean
    }

const answersIn = (comment: StagedComment): number => comment.answers?.length ?? 0

const newerOf = (state: TuiState, comment: StagedComment): StagedComment => {
  if (comment.id === undefined) return comment
  const later = state.arrived.find((entry) => entry.id === comment.id)
  if (later === undefined) return comment
  return answersIn(later) > answersIn(comment) ? later : comment
}

const spokeLast = (comment: StagedComment): "reviewer" | "agent" | undefined =>
  comment.turns?.at(-1)?.voice

const SECTION_OF: Readonly<Record<ThreadStand, PanelSection>> = {
  filed: "filed",
  gone: "removed",
  settled: "settled",
  asked: "asked",
  answered: "answered",
  waiting: "with",
}

export const movedPast = (comment: StagedComment): boolean =>
  comment.outside === true && comment.settled !== true && comment.removed !== true

const sectionOf = (comment: StagedComment): PanelSection =>
  movedPast(comment) ? "movedOn" : SECTION_OF[threadStand(comment)]

const sentEntry = (state: TuiState, comment: StagedComment): PanelEntry => {
  const newer = newerOf(state, comment)
  return {
    kind: "comment",
    section: sectionOf(newer),
    comment: newer,
    fresh: newer !== comment,
    unread: newer.unread ?? 0,
  }
}

const remarkRows = (state: TuiState, section: "remarks" | "dismissed"): ReadonlyArray<PanelEntry> =>
  state.remarks
    .filter((one) => (section === "remarks" ? one.state === "waiting" : one.state === "dismissed"))
    .map((remark): PanelEntry => ({ kind: "remark", section, remark }))

export const panelHolds = (state: TuiState): ReadonlyArray<PanelEntry> =>
  panelEntries({ ...state, openMoved: true }).filter((entry) => entry.kind !== "fold")

export const panelEntries = (state: TuiState): ReadonlyArray<PanelEntry> => {
  const shown = state.hideSettled
    ? state.sent.filter((comment) => comment.settled !== true)
    : state.sent
  const waiting = state.held.map(
    (comment): PanelEntry => ({
      kind: "comment",
      section: "held",
      comment,
      fresh: false,
      unread: 0,
    }),
  )
  const delivered = [
    ...remarkRows(state, "remarks"),
    ...waiting,
    ...shown.map((comment) => sentEntry(state, comment)),
    ...remarkRows(state, "dismissed"),
  ]
  const ordered = (section: PanelSection): ReadonlyArray<PanelEntry> => {
    const found = delivered.filter((entry) => entry.section === section)
    const held = state.newestFirst ? found.toReversed() : found
    if (section !== "movedOn" || held.length === 0) return held
    const fold: PanelEntry = {
      kind: "fold",
      section,
      held: held.length,
      open: state.openMoved,
    }
    return state.openMoved ? [fold, ...held] : [fold]
  }
  return PANEL_SECTIONS.flatMap((section) => ordered(section))
}

export const panelEntry = (state: TuiState): PanelEntry | undefined =>
  panelEntries(state)[state.panelIndex]

export const threadChosen = (state: TuiState): StagedComment | undefined => {
  if (state.focus !== "review") return undefined
  const entry = panelEntry(state)
  return entry?.kind === "comment" ? entry.comment : undefined
}

export const remarkChosen = (state: TuiState): Remark | undefined => {
  if (state.focus !== "review") return undefined
  const entry = panelEntry(state)
  return entry?.kind === "remark" ? entry.remark : undefined
}

export const spokenSince = (
  seen: ReadonlyArray<StagedComment>,
  now: ReadonlyArray<StagedComment>,
): number => Math.max(0, answerCount(now) - answerCount(seen))

export const hunkStarts = (state: TuiState): ReadonlyArray<number> => {
  const rows = selectedPatch(state)?.rows ?? []
  const starts: Array<number> = []
  let running = false
  for (const [index, row] of rows.entries()) {
    const changed = row.kind !== "context"
    if (changed && !running) starts.push(index)
    running = changed
  }
  return starts
}

export const openingRow = (state: TuiState, patchIndex: number): number => {
  const rows = state.patches[patchIndex]?.rows ?? []
  const at = rows.findIndex((row) => carriesLine(row))
  return at === -1 ? 0 : at
}

export const changeAround = (state: TuiState): readonly [number, number] | undefined => {
  const rows = selectedPatch(state)?.rows ?? []
  const changed = (at: number): boolean => {
    const row = rows[at]
    return row !== undefined && row.kind !== "context"
  }
  if (!changed(state.cursor)) return undefined
  let first = state.cursor
  let last = state.cursor
  while (changed(first - 1)) first -= 1
  while (changed(last + 1)) last += 1
  return [first, last]
}

export const nextUnreviewed = (state: TuiState, from: number): number | undefined => {
  const order = fileOrder(state)
  const start = Math.max(0, order.indexOf(from))
  const rotated = [...order.slice(start + 1), ...order.slice(0, start + 1)]
  return rotated.find((index) => !isReviewed(state, index))
}

export const reviewedCount = (state: TuiState): string =>
  `${state.vouched.length} reviewed`

export const fileOrder = (state: TuiState): ReadonlyArray<number> =>
  onLayers(state)
    ? state.layers.flatMap((_, at) => layerFiles(state, at))
    : flattenTree(treeOf(state), []).flatMap((row) =>
        row.fileIndex === undefined ? [] : [row.fileIndex],
      )

export const filePlace = (state: TuiState): { readonly at: number; readonly of: number } => {
  const order = readingOrder(state)
  const at = placeIn(state)
  if (at === -1) return { at: state.patchIndex + 1, of: state.patches.length }
  return { at: at + 1, of: order.length }
}

export const readingOrder = (
  state: TuiState,
): ReadonlyArray<{ readonly layer: number; readonly file: number }> =>
  onLayers(state)
    ? state.layers.flatMap((_, layer) =>
        layerFiles(state, layer).map((file) => ({ layer, file })),
      )
    : fileOrder(state).map((file) => ({ layer: state.layerIndex, file }))

export const placeIn = (state: TuiState): number => {
  const order = readingOrder(state)
  const at = order.findIndex(
    (one) => one.file === state.patchIndex && (!onLayers(state) || one.layer === state.layerIndex),
  )
  return at === -1 ? order.findIndex((one) => one.file === state.patchIndex) : at
}

export const layerFile = (state: TuiState, delta: number): number => {
  const order = readingOrder(state)
  const at = placeIn(state)
  if (at === -1) return order[0]?.file ?? state.patchIndex
  const next = Math.max(0, Math.min(order.length - 1, at + delta))
  return order[next]?.file ?? state.patchIndex
}

export const layerAfter = (state: TuiState, delta: number): number => {
  const order = readingOrder(state)
  const at = placeIn(state)
  if (at === -1) return order[0]?.layer ?? state.layerIndex
  const next = Math.max(0, Math.min(order.length - 1, at + delta))
  return order[next]?.layer ?? state.layerIndex
}

export const selectionRange = (state: TuiState): readonly [number, number] =>
  state.anchorRow <= state.cursor ? [state.anchorRow, state.cursor] : [state.cursor, state.anchorRow]
