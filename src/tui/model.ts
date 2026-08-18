import { Option } from "effect"

export type StagedComment = {
  readonly id?: string
  readonly file: string
  readonly side: "old" | "new"
  readonly start: number
  readonly end: number
  readonly body: string
  readonly settled?: boolean
  readonly stale?: boolean
  readonly asks?: boolean
  readonly answers?: ReadonlyArray<string>
  readonly turns?: ReadonlyArray<{ readonly voice: "reviewer" | "agent"; readonly body: string }>
  readonly unread?: number
}
import { anchorFor, type Patch } from "../domain/patch/index.ts"
import { shownOf, type Reveal } from "./gaps.ts"
import { buildTree, crowdedDirectories, flattenTree, type Tree, type TreeRow } from "./tree.ts"
import type { BranchSummary, Match, ReportedLayer } from "../cli/index.ts"
import type { ProseAnchor } from "../domain/layers/index.ts"

export type LayerRow = {
  readonly index: number
  readonly kind: "title" | "note" | "file"
  readonly text: string
  readonly lead: boolean
}

export type Spot = { readonly row: number; readonly column: number }

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
  readonly anchorRow: number
  readonly selecting: boolean
  readonly draft: string
  readonly notice: string
  readonly waiting: string
  readonly query: string
  readonly paletteIndex: number
  readonly returnTo: Screen
  readonly closed: ReadonlyArray<string>
  readonly vouched: ReadonlyArray<string>
  readonly sent: ReadonlyArray<StagedComment>
  readonly viewport: number
  readonly context: number
  readonly contextWas: number
  readonly top: number
  readonly source: ReadonlyArray<string>
  readonly full: ReadonlyArray<Patch>
  readonly revealed: ReadonlyArray<Reveal>
  readonly focus: "tree" | "diff" | "review"
  readonly navOpen: boolean
  readonly wrap: boolean
  readonly sticky: boolean
  readonly pan: number
  readonly layers: ReadonlyArray<ReportedLayer>
  readonly layersStale: boolean
  readonly pulls: Readonly<Record<string, string>>
  readonly forge: ForgeAnswer
  readonly layerIndex: number
  readonly openLayers: ReadonlyArray<number>
  readonly rail: "tree" | "layers"
  readonly term: string
  readonly matches: ReadonlyArray<Match>
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
  readonly tallest: number
  readonly scroll: number
  readonly railRows: number
  readonly railScroll: number
}

const nothingReviewed = {
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
  tallest: 0,
  scroll: -1,
  railRows: 12,
  railScroll: -1,
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
  notice: "",
  waiting: "",
  query: "",
  paletteIndex: 0,
  returnTo: "branches",
  closed: [],
  vouched: [],
  sent: [],
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
  pulls: {},
  forge: "asking",
  layerIndex: 0,
  openLayers: [],
  term: "",
  matches: [],
  matchIndex: 0,
  rail: "tree",
})

const FRAME_PAD = 1
const PANE_BORDER = 2
const TREE_MAX = 34
const TREE_ROOMY = 40
const TREE_MIN = 18
const TREE_SHARE = 0.3
const DIFF_MIN = 26
const PANEL_WIDTH = 34
const DIFF_ROOMY = 58

export const bodyRoom = (columns: number): number => Math.max(0, columns - FRAME_PAD * 2)

export const treeWidth = (columns: number): number => {
  const room = bodyRoom(columns)
  const most = room - reviewWidth() - DIFF_ROOMY >= TREE_ROOMY ? TREE_ROOMY : TREE_MAX
  const wanted = Math.min(most, Math.max(TREE_MIN, Math.floor(room * TREE_SHARE)))
  return Math.max(0, Math.min(wanted, room - DIFF_MIN))
}

export const reviewWidth = (): number => PANEL_WIDTH + PANE_BORDER

export const panelFits = (state: TuiState): boolean =>
  bodyRoom(state.columns) - treeWidth(state.columns) - reviewWidth() >= DIFF_ROOMY

export const panelShown = (state: TuiState): boolean =>
  state.screen !== "branches" && state.panelOpen && panelFits(state)

export const onLayers = (state: TuiState): boolean =>
  state.rail === "layers" && state.layers.length > 0

export const selectedLayer = (state: TuiState): ReportedLayer | undefined => state.layers[state.layerIndex]

export const proseFor = (state: TuiState, path: string): ReadonlyArray<ProseAnchor> => {
  if (!onLayers(state)) return []
  const layer = selectedLayer(state)
  if (layer === undefined) return []
  return layer.prose.filter((anchor) => anchor.path === path)
}

export const layerFiles = (state: TuiState, layerIndex: number): ReadonlyArray<number> => {
  const layer = state.layers[layerIndex]
  if (layer === undefined) return []
  return layer.files.flatMap((path) => {
    const at = state.patches.findIndex((patch) => patch.path === path)
    return at === -1 ? [] : [at]
  })
}

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

export const wordWrapped = (text: string, room: number): ReadonlyArray<string> => {
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

export const NO_NOTE = "no note"

const noteRows = (state: TuiState, layerIndex: number, room: number): ReadonlyArray<LayerRow> => {
  const lines = wrapped(state.layers[layerIndex]?.note ?? "", room)
  const shown = lines.length === 0 ? [NO_NOTE] : lines
  return shown.map((text) => ({ index: layerIndex, kind: "note" as const, text, lead: false }))
}

const proseRow = (layerIndex: number, text: string): LayerRow => ({
  index: layerIndex,
  kind: "note",
  text,
  lead: false,
})

const proseRows = (state: TuiState, layerIndex: number, room: number): ReadonlyArray<LayerRow> => {
  const blocks = state.layers[layerIndex]?.prose ?? []
  const rows: Array<LayerRow> = []
  for (const [at, block] of blocks.entries()) {
    if (at > 0) rows.push(proseRow(layerIndex, ""))
    for (const text of wrapped(block.markdown, room)) rows.push(proseRow(layerIndex, text))
    rows.push({
      index: layerIndex,
      kind: "file",
      text: clipEnd(block.path, Math.max(1, room - FILE_LEAD)),
      lead: false,
    })
  }
  return rows
}

const titleRows = (state: TuiState, layerIndex: number, room: number): ReadonlyArray<LayerRow> =>
  wordWrapped(state.layers[layerIndex]?.title ?? "", room).map((text, at) => ({
    index: layerIndex,
    kind: "title" as const,
    text,
    lead: at === 0,
  }))

const clipEnd = (text: string, room: number): string => {
  if (text.length <= room) return text
  const parts = text.split("/")
  const kept: Array<string> = []
  for (const part of parts.toReversed()) {
    const wanted = [part, ...kept].join("/")
    if (wanted.length + 2 > room) break
    kept.unshift(part)
  }
  const tail = kept.length === 0 ? (parts.at(-1) ?? text) : kept.join("/")
  return `…/${tail}`
}

const FILE_LEAD = 2

const fileRows = (state: TuiState, layerIndex: number, room: number): ReadonlyArray<LayerRow> =>
  (state.layers[layerIndex]?.files ?? []).map((path) => ({
    index: layerIndex,
    kind: "file" as const,
    text: clipEnd(path, Math.max(1, room - FILE_LEAD)),
    lead: false,
  }))

export const layerRows = (
  state: TuiState,
  titleRoom: number,
  noteRoom: number,
): ReadonlyArray<LayerRow> =>
  state.layers.flatMap((_, index) =>
    layerOpen(state, index)
      ? [
          ...titleRows(state, index, titleRoom),
          ...((state.layers[index]?.prose ?? []).length > 0
            ? proseRows(state, index, noteRoom)
            : [...noteRows(state, index, noteRoom), ...fileRows(state, index, noteRoom)]),
        ]
      : titleRows(state, index, titleRoom),
  )

export const railWindow = (
  rows: ReadonlyArray<LayerRow>,
  height: number,
  layerIndex: number,
): { readonly rows: ReadonlyArray<LayerRow>; readonly more: number } => {
  if (rows.length <= height) return { rows, more: 0 }
  const first = Math.max(0, rows.findIndex((row) => row.index === layerIndex))
  const block = rows.findLastIndex((row) => row.index === layerIndex) - first + 1
  const wanted = block >= height ? first : first - Math.floor((height - block) / 2)
  const start = Math.max(0, Math.min(rows.length - height, wanted))
  return { rows: rows.slice(start, start + height), more: rows.length - (start + height) }
}

export const selectedBranch = (state: TuiState): BranchSummary | undefined =>
  state.branches[state.branchIndex]

export const selectedPatch = (state: TuiState): Patch | undefined => shownOf(state)?.patch

export const pullHere = (state: TuiState): string =>
  state.pulls[selectedBranch(state)?.branch ?? ""] ?? ""

export const knownToHaveNoPull = (state: TuiState): boolean =>
  state.forge === "answered" && pullHere(state).length === 0

const kept = (state: TuiState, at: number): boolean =>
  !state.hideReviewed || at === state.patchIndex || !isReviewed(state, at)

export const treeOf = (state: TuiState): Tree =>
  buildTree(state.patches.map((patch, at) => (kept(state, at) ? patch.path : "")))

export const reviewedCountIn = (state: TuiState): number =>
  state.patches.filter((_, at) => isReviewed(state, at)).length

export const CROWDED = 8

export const treeRows = (state: TuiState): ReadonlyArray<TreeRow> => {
  const tree = treeOf(state)
  return flattenTree(tree, state.closed)
}

export const crowdedOf = (patches: TuiState["patches"]): ReadonlyArray<string> =>
  crowdedDirectories(buildTree(patches.map((patch) => patch.path)), CROWDED)

export const directoryOfFile = (state: TuiState, fileIndex: number): string | undefined => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return undefined
  const segments = patch.path.split("/")
  return segments.length < 2 ? undefined : segments.slice(0, -1).join("/")
}

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

export const commentsOn = (state: TuiState, fileIndex: number): number => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return 0
  return state.sent.filter((entry) => entry.file === patch.path).length
}

export const hiddenLines = (state: TuiState): number =>
  shownOf(state)?.gaps.reduce((total, gap) => total + gap.hidden, 0) ?? 0

export const markedRows = (state: TuiState): ReadonlySet<number> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return new Set()
  const here = state.sent.filter((entry) => entry.file === patch.path)
  const rows = here.flatMap((entry) =>
    patch.rows
      .filter((row) =>
        Option.match(row.newLine, {
          onNone: () => false,
          onSome: (line) => line >= entry.start && line <= entry.end,
        }),
      )
      .map((row) => row.index),
  )
  return new Set(rows)
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

const replyTarget = (state: TuiState): string => {
  const thread = state.sent.find((entry) => entry.id === state.replyTo)
  if (thread === undefined) return "Reply"
  return `Reply on ${thread.file}:${thread.end}`
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

export const selectedLines = (state: TuiState): ReadonlyArray<string> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const [from, to] = selectionRange(state)
  return patch.rows.slice(from, to + 1).map((row) => row.text)
}

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "export", "import", "from", "type", "interface",
  "class", "extends", "implements", "async", "await", "new", "this", "if", "else", "for", "while",
  "switch", "case", "default", "break", "continue", "throw", "try", "catch", "finally", "typeof",
  "readonly", "public", "private", "static", "true", "false", "null", "undefined", "void", "string",
  "number", "boolean", "any", "unknown", "never",
])

const NAME = /[A-Za-z_$][\w$]*/g

const longestName = (line: string): string | undefined =>
  [...line.matchAll(NAME)]
    .map((found) => found[0])
    .filter((name) => !KEYWORDS.has(name))
    .toSorted((left, right) => right.length - left.length)[0]

export const searchTerm = (state: TuiState): string => {
  const line = selectedLines(state)
    .map((text) => text.trim())
    .find((text) => text.length > 0)
  if (line === undefined) return ""
  return longestName(line) ?? line
}

export const matchHere = (state: TuiState): Match | undefined => state.matches[state.matchIndex]

export const selectionReadout = (state: TuiState): string => {
  const patch = selectedPatch(state)
  if (patch === undefined || !state.selecting) return ""
  const lines = selectedRows(state).length
  return `${patch.path}  ${lines} ${lines === 1 ? "line" : "lines"}`
}

export const WHOLE_FILE = 100_000

export const CONTEXT_STEPS: ReadonlyArray<number> = [3, 10, 25, 60, WHOLE_FILE]

export const wholeFileOff = (state: TuiState): boolean => state.context < WHOLE_FILE

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

export const commentRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> => {
  const patch =
    fileIndex === state.patchIndex ? selectedPatch(state) : state.patches[fileIndex]
  if (patch === undefined) return []
  const notes = state.sent.filter((entry) => entry.file === patch.path)
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
      lineOnSide(here, entry.side) === entry.end,
  )
}

export const stopsAtRow = (state: TuiState, row: number): number =>
  1 + threadsAtRow(state, row).length

export const threadAtStop = (state: TuiState): StagedComment | undefined =>
  state.stop === 0 ? undefined : threadsAtRow(state, state.cursor)[state.stop - 1]

export const threadAtRow = (state: TuiState, row: number): StagedComment | undefined => {
  const patch = selectedPatch(state)
  const here = patch?.rows[row]
  if (patch === undefined || here === undefined) return undefined
  return state.sent.find(
    (entry) =>
      entry.file === patch.path &&
      entry.id !== undefined &&
      lineOnSide(here, entry.side) === entry.end,
  )
}

export const openCommentRows = (state: TuiState): ReadonlyArray<number> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const open = state.sent.filter(
    (entry) => entry.file === patch.path && entry.settled !== true,
  )
  return patch.rows
    .filter((row) => open.some((note) => lineOnSide(row, note.side) === note.end))
    .map((row) => row.index)
}

export const filesWithComments = (state: TuiState): ReadonlyArray<number> =>
  state.patches.flatMap((patch, index) =>
    state.sent.some((entry) => entry.file === patch.path) ? [index] : [],
  )

const answerCount = (comments: ReadonlyArray<StagedComment>): number =>
  comments.reduce((total, entry) => total + (entry.answers?.length ?? 0), 0)

export type PanelSection = "with" | "answered"

export type PanelEntry = {
  readonly section: PanelSection
  readonly comment: StagedComment
  readonly fresh: boolean
  readonly unread: number
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

const sectionOf = (comment: StagedComment): PanelSection => {
  if (spokeLast(comment) === "reviewer" && comment.settled !== true) return "with"
  return answersIn(comment) > 0 || comment.settled === true ? "answered" : "with"
}

const sentEntry = (state: TuiState, comment: StagedComment): PanelEntry => {
  const newer = newerOf(state, comment)
  return {
    section: sectionOf(newer),
    comment: newer,
    fresh: newer !== comment,
    unread: newer.unread ?? 0,
  }
}

export const panelEntries = (state: TuiState): ReadonlyArray<PanelEntry> => {
  const shown = state.hideSettled
    ? state.sent.filter((comment) => comment.settled !== true)
    : state.sent
  const delivered = shown.map((comment) => sentEntry(state, comment))
  const ordered = (section: PanelSection): ReadonlyArray<PanelEntry> => {
    const found = delivered.filter((entry) => entry.section === section)
    return state.newestFirst ? found.toReversed() : found
  }
  return [...ordered("with"), ...ordered("answered")]
}

export const panelIndexOf = (state: TuiState, id: string | undefined): number => {
  if (id === undefined) return state.panelIndex
  const at = panelEntries(state).findIndex((entry) => entry.comment.id === id)
  return at === -1 ? state.panelIndex : at
}

export const panelEntry = (state: TuiState): PanelEntry | undefined =>
  panelEntries(state)[state.panelIndex]

export const threadChosen = (state: TuiState): StagedComment | undefined => {
  if (state.focus !== "review") return undefined
  const entry = panelEntry(state)
  return entry?.comment
}

export const freshAnswers = (state: TuiState): number =>
  panelEntries(state).filter((entry) => entry.fresh).length

export const unreadAnswers = (state: TuiState): number =>
  panelEntries(state).filter((entry) => entry.unread > 0).length

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
  `${state.vouched.length}/${state.patches.length} reviewed`

export const countsOf = (state: TuiState, fileIndex: number): string => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return ""
  const total = patch.added + patch.removed
  return total === 0 ? "" : String(total)
}

export const fileOrder = (state: TuiState): ReadonlyArray<number> =>
  onLayers(state)
    ? layerFiles(state, state.layerIndex)
    : flattenTree(treeOf(state), []).flatMap((row) =>
        row.fileIndex === undefined ? [] : [row.fileIndex],
      )

export const layerFile = (state: TuiState, delta: number): number => {
  const order = fileOrder(state)
  const position = order.indexOf(state.patchIndex)
  if (position === -1) return order[0] ?? state.patchIndex
  const next = Math.max(0, Math.min(order.length - 1, position + delta))
  return order[next] ?? state.patchIndex
}

export const selectionRange = (state: TuiState): readonly [number, number] =>
  state.anchorRow <= state.cursor ? [state.anchorRow, state.cursor] : [state.cursor, state.anchorRow]
