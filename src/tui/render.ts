import {
  BoxRenderable,
  RGBA,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core"
import { ASCIIFontRenderable, bg, fg, StyledText, t, type TextChunk } from "@opentui/core"
import { displayKey, hintsFor, takesText, type Command } from "./command.ts"
import { stickyChain, type RowKind } from "../domain/patch/index.ts"
import { DiffView, type LinePaint, type Note } from "./diffview.ts"
import { gapRowSet, shownOf } from "./gaps.ts"
import { keyMatches, paletteMatches } from "./reduce.ts"
import {
  composeTarget,
  commentsOn,
  hiddenLines,
  isReviewed,
  markedRows,
  newLineAt,
  onLayers,
  railWindow,
  matchHere,
  selectionReadout,
  layerOpen,
  layerRows,
  type LayerRow,
  wrapped,
  selectedLineCount,
  snippetOf,
  reviewedCount,
  reviewedCountIn,
  pullHere,
  selectedBranch,
  selectedPatch,
  selectionRange,
  threadChosen,
  treeWindow,
  treeWidth,
  type TuiState,
  WHOLE_FILE,
  type StagedComment,
  proseFor,
  caretAt,
  composeBox,
  composeRoom as composeText,
  caretColumn,
  caretRow,
  laidDraft,
  panelEntries,
  panelShown,
  reviewWidth,
  type PanelEntry,
  type PanelSection,
  type Spot,
} from "./model.ts"
import type { TreeRow } from "./tree.ts"
import { marks } from "./marks.ts"
import { palette } from "./theme.ts"

const ROW_HEIGHT = 1
const COMPOSE_WIDTH = 72
const GUTTER_X = 2
const CHIP_GAP = 4
const FRAME_PAD = 1
const MODAL_ROOM = 8
const COMPOSE_CHROME = 3
const COMPOSE_ACTION_ROWS = 2

const reportActions = (full: boolean): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^t")} ${fg(palette.muted)(full ? "sending everything" : "sending the least")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)("copy and save")}`

const actionsText = (): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)("send it")}`
const SNIPPET_LINES = 4
const PALETTE_KEY = 7
const PALETTE_TITLE = 60
const PALETTE_GAP = 2
const PALETTE_CHROME = 4
const PENDING_CHROME = 3
const PALETTE_WIDTH = 76
const PANEL_SHARE = 0.62
const PANEL_MAX = 120
const PANEL_FLOOR = 6
const PANEL_FOOT = 2
const PANEL_QUARTER = 4
const PANEL_FIFTH = 5
const PANE_CHROME = 3
const PANE_EDGES = 2
const PANE_INSET = 1
const BRANCH_WIDTH = 82
const BRANCH_NAME_MIN = 12
const BRANCH_TAIL = 45
const EMPTY_LIST = "  nothing to review. No worktree differs from the branch it started from."
const MODAL_MARGIN = 4

const shareOf = (width: number, least: number): number =>
  Math.max(least, Math.min(PANEL_MAX, Math.floor(width * PANEL_SHARE)))

const homeWidth = (width: number, longest: number): number =>
  Math.max(
    0,
    Math.min(width - FRAME_PAD * 2, Math.min(PANEL_MAX, Math.max(BRANCH_WIDTH, longest + BRANCH_TAIL))),
  )

const longestName = (state: TuiState): number =>
  Math.max(0, ...state.branches.map((branch) => branch.branch.length))

const commandRow = (entry: Command, room: number): string => {
  const key = clip(displayKey(entry.keys[0] ?? ""), PALETTE_KEY - PALETTE_GAP).padEnd(PALETTE_KEY)
  const left = Math.max(1, Math.min(PALETTE_TITLE, room - PALETTE_KEY - entry.category.length - PALETTE_GAP))
  return `${key}${clip(entry.title, left - PALETTE_GAP).padEnd(left)}${entry.category}`
}

const modalWidth = (width: number, wanted: number): number =>
  Math.max(0, Math.min(wanted, width - MODAL_MARGIN))

const panelWidth = (width: number): number => modalWidth(width, shareOf(width, PALETTE_WIDTH))

const panelTop = (height: number, part: number): number => Math.max(2, Math.floor(height / part))

const panelRows = (height: number, part: number): number =>
  Math.max(PANEL_FLOOR, height - panelTop(height, part) - PANEL_FOOT)

type ComposeRoom = { readonly box: number; readonly text: number }

const composeRoom = (width: number): ComposeRoom => ({
  box: composeBox(width),
  text: composeText(width),
})

const CARET_ROOM = 1

const draftText = (state: TuiState, room: number): { rows: ReadonlyArray<TextChunk>; height: number } => {
  const rows = laidDraft(state.draft, room)
  const at = caretAt(state)
  const here = caretRow(rows, at)
  const column = caretColumn(rows, at)
  const drawn = rows.flatMap((row, index) => {
    const tail = index === rows.length - 1 ? "" : "\n"
    if (index !== here) return [fg(palette.ink)(`${row.text}${tail}`)]
    const before = row.text.slice(0, column)
    const under = row.text.slice(column, column + CARET_ROOM)
    const after = row.text.slice(column + CARET_ROOM)
    return [
      fg(palette.ink)(before),
      bg(palette.ink)(fg(palette.panel)(under.length === 0 ? " " : under)),
      fg(palette.ink)(`${after}${tail}`),
    ]
  })
  return { rows: drawn, height: rows.length }
}

const laidOut = (lines: ReadonlyArray<string>, room: number): ReadonlyArray<string> =>
  lines.flatMap((line) => {
    const parts = wrapped(line, room)
    return parts.length === 0 ? [""] : parts
  })

const STICKY_MAX = 4

type PaintFlags = {
  readonly cursor: boolean
  readonly selected: boolean
  readonly gap: boolean
}

const pickPaint = (view: DiffView, kind: RowKind, flags: PaintFlags): LinePaint | undefined => {
  if (flags.cursor) return { gutter: ACCENT, content: CURSOR }
  if (flags.selected) return { gutter: SELECTION, content: SELECTION }
  if (flags.gap) return GAP_PAINT
  return view.washOf(kind)
}

const SELECTION = RGBA.fromHex(palette.selection)
const CURSOR = RGBA.fromHex(palette.cursor)
const ACCENT = RGBA.fromHex(palette.accent)
const GAP_PAINT: LinePaint = {
  gutter: RGBA.fromHex(palette.overlay),
  content: RGBA.fromHex(palette.overlay),
}

const bar = (renderer: CliRenderer, id: string, color: string): TextRenderable =>
  new TextRenderable(renderer, {
    id,
    content: "",
    fg: color,
    height: ROW_HEIGHT,
    flexShrink: 0,
    marginLeft: GUTTER_X,
    marginRight: GUTTER_X,
  })

const makeList = (renderer: CliRenderer): BoxRenderable => {
  const box = new BoxRenderable(renderer, {
    id: "list-pane",
    width: BRANCH_WIDTH,
    flexShrink: 0,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    borderColor: palette.rule,
  })
  return box
}

const makeDiffPane = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "diff-pane",
    flexGrow: 1,
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
    visible: false,
  })

const makePanel = (renderer: CliRenderer): { pane: BoxRenderable; text: TextRenderable } => {
  const pane = new BoxRenderable(renderer, {
    id: "panel-pane",
    width: 0,
    flexShrink: 0,
    flexDirection: "column",
    minHeight: 0,
    overflow: "hidden",
    borderColor: palette.rule,
    visible: false,
  })
  const text = new TextRenderable(renderer, {
    id: "panel",
    content: "",
    fg: palette.ink,
    flexGrow: 1,
    wrapMode: "none",
  })
  pane.add(text)
  return { pane, text }
}

const makeListParts = (renderer: CliRenderer): { pane: BoxRenderable; text: TextRenderable } => {
  const pane = makeList(renderer)
  const text = makeListText(renderer)
  pane.add(text)
  return { pane, text }
}

const makeListText = (renderer: CliRenderer): TextRenderable =>
  new TextRenderable(renderer, {
    id: "list",
    content: "",
    fg: palette.ink,
    flexGrow: 1,
    wrapMode: "none",
  })

const makeGutter = (renderer: CliRenderer): TextRenderable =>
  new TextRenderable(renderer, {
    id: "gutter",
    content: "",
    fg: palette.marker,
    width: 2,
    flexShrink: 0,
    wrapMode: "none",
  })

const makeScroller = (
  renderer: CliRenderer,
  gutter: TextRenderable,
  scroll: BoxRenderable,
): BoxRenderable => {
  const box = new BoxRenderable(renderer, {
    id: "scroller",
    flexGrow: 1,
    flexDirection: "row",
    minHeight: 0,
  })
  box.add(gutter)
  box.add(scroll)
  return box
}

const makeScrim = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "scrim",
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    zIndex: 90,
    visible: false,
    backgroundColor: palette.scrim,
  })

const makeScroll = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "diff-scroll",
    flexGrow: 1,
    flexDirection: "column",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  })

const makePalette = (renderer: CliRenderer): BoxRenderable => {
  const box = makeCompose(renderer)
  box.id = "palette"
  box.height = PANEL_FLOOR
  box.width = PALETTE_WIDTH
  return box
}

type PaletteParts = {
  readonly box: BoxRenderable
  readonly title: TextRenderable
  readonly query: TextRenderable
  readonly choices: TextRenderable
}

const makePaletteParts = (renderer: CliRenderer): PaletteParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "palette-title", palette.faint)
  const query = bar(renderer, "palette-query", palette.ink)
  const choices = makeChoices(renderer)
  box.add(title)
  box.add(query)
  box.add(choices)
  return { box, title, query, choices }
}

const makeChoices = (renderer: CliRenderer): TextRenderable =>
  new TextRenderable(renderer, {
    id: "palette-choices",
    content: "",
    flexGrow: 1,
    fg: palette.ink,
    selectable: true,
  })

const LIST_LEAD = 2

const windowed = <Row,>(
  rows: ReadonlyArray<Row>,
  at: number,
  height: number,
): { readonly rows: ReadonlyArray<Row>; readonly from: number } => {
  if (rows.length <= height) return { rows, from: 0 }
  const last = rows.length - height
  const from = Math.max(0, Math.min(last, at - Math.floor(height / 2)))
  return { rows: rows.slice(from, from + height), from }
}

const listText = (
  rows: ReadonlyArray<string>,
  at: number,
  height: number,
): StyledText => {
  const shown = windowed(rows, at, Math.max(1, height))
  const drawn = shown.rows.map((row, index) => {
    const here = shown.from + index === at
    const text = `${here ? "▶ " : "  "}${row}`.padEnd(LIST_LEAD)
    return here ? bg(palette.selection)(fg(palette.ink)(`${text}\n`)) : fg(palette.ink)(`${text}\n`)
  })
  return new StyledText(drawn)
}

const stack = (parent: { add: (child: never) => void }, children: ReadonlyArray<unknown>): void => {
  for (const child of children) parent.add(child as never)
}

const makeBody = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "body",
    flexGrow: 1,
    flexDirection: "row",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  })

const makeHome = (renderer: CliRenderer) => ({
  logo: makeLogo(renderer),
  path: makeLanding(renderer, "landing", palette.muted, 0),
  keys: makeLanding(renderer, "landing-keys", palette.faint, 2),
})

const makeModals = (renderer: CliRenderer) => ({
  palette: makePaletteParts(renderer),
  found: makeFoundParts(renderer),
  keys: makeKeysParts(renderer),
})

const makeKeysParts = (renderer: CliRenderer): PaletteParts => {
  const parts = makePaletteParts(renderer)
  parts.box.id = "keys"
  return parts
}

const makeFoundParts = (renderer: CliRenderer): PaletteParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "found-title", palette.faint)
  const query = bar(renderer, "found-peek", palette.muted)
  const choices = makeChoices(renderer)
  box.id = "found"
  box.add(title)
  box.add(choices)
  box.add(query)
  return { box, title, query, choices }
}

const FONTS = ["tiny", "block", "shade", "slick", "huge", "grid", "pallet"] as const

const logoFont = (): (typeof FONTS)[number] => {
  const wanted = process.env["ADIFF_FONT"] ?? ""
  return FONTS.find((name) => name === wanted) ?? "tiny"
}

const makeLanding = (
  renderer: CliRenderer,
  id: string,
  color: string,
  top: number,
): TextRenderable =>
  new TextRenderable(renderer, {
    id,
    content: "",
    fg: color,
    alignSelf: "center",
    marginTop: top,
    marginBottom: top === 0 ? 2 : 0,
    flexShrink: 0,
  })

const makeLogo = (renderer: CliRenderer): ASCIIFontRenderable =>
  new ASCIIFontRenderable(renderer, {
    id: "logo",
    text: "adiff",
    font: logoFont(),
    color: palette.accent,
    alignSelf: "center",
    marginBottom: 2,
    flexShrink: 0,
  })

const makeComposeParts = (
  renderer: CliRenderer,
): {
  readonly title: TextRenderable
  readonly body: TextRenderable
  readonly actions: TextRenderable
} => ({
  title: new TextRenderable(renderer, {
    id: "compose-title",
    content: "",
    fg: palette.ink,
    wrapMode: "none",
  }),
  body: new TextRenderable(renderer, {
    id: "compose-body",
    content: "",
    fg: palette.ink,
    wrapMode: "none",
  }),
  actions: new TextRenderable(renderer, {
    id: "compose-actions",
    content: "",
    fg: palette.muted,
    marginTop: 1,
    wrapMode: "none",
  }),
})

const makeCompose = (renderer: CliRenderer): BoxRenderable =>
  new BoxRenderable(renderer, {
    id: "compose",
    position: "absolute",
    width: COMPOSE_WIDTH,
    height: COMPOSE_CHROME,
    zIndex: 100,
    visible: false,
    backgroundColor: palette.panel,
    border: ["left"],
    borderStyle: "heavy",
    borderColor: palette.accent,
    paddingLeft: GUTTER_X,
    paddingRight: GUTTER_X,
    paddingTop: 1,
    paddingBottom: 1,
    flexDirection: "column",
  })

const clip = (label: string, room: number): string =>
  label.length > room ? `${label.slice(0, Math.max(0, room - 1))}…` : label

const clipHead = (label: string, room: number): string =>
  label.length > room ? `…${label.slice(label.length - Math.max(0, room - 1))}` : label

const clipMiddle = (label: string, room: number): string => {
  if (label.length <= room) return label
  const kept = Math.max(0, room - 1)
  const front = Math.floor(kept / 2)
  return `${label.slice(0, front)}…${label.slice(label.length - (kept - front))}`
}

const clipPath = (label: string, room: number): string => {
  if (label.length <= room) return label
  const segments = label.split("/")
  const kept = segments.reduce<Array<string>>((tail, _, index) => {
    const candidate = segments.slice(segments.length - index - 1)
    return `…/${candidate.join("/")}`.length <= room ? candidate : tail
  }, [])
  return kept.length === 0 ? clipHead(label, room) : `…/${kept.join("/")}`
}

const treeLabel = (state: TuiState, row: TreeRow, room: number): string => {
  const indent = " ".repeat(row.depth)
  if (row.kind === "file") {
    const lead = `${indent}  ${marks().file} `
    return `${lead}${clipMiddle(row.name, Math.max(4, room - lead.length))}`
  }
  const shut = state.closed.includes(row.path)
  const lead = `${indent}${shut ? "▸" : "▾"} ${shut ? marks().folder : marks().folderOpen} `
  return `${lead}${clipPath(row.name, Math.max(4, room - lead.length))}`
}

const waitingLabel = (branch: TuiState["branches"][number]): string =>
  branch.unread > 0 ? `${branch.unread} unanswered` : ""

const inRange = (state: TuiState, row: number, from: number, to: number): boolean =>
  state.selecting && row >= from && row <= to

const notesOf = (
  comments: ReadonlyArray<StagedComment>,
  path: string,
  sent: boolean,
  opened: ReadonlyArray<string> = [],
): ReadonlyArray<Note> =>
  comments
    .filter((entry) => entry.file === path)
    .map((entry) => ({
      id: entry.id ?? "",
      folded: entry.settled === true && !(entry.id !== undefined && opened.includes(entry.id)),
      side: entry.side,
      line: entry.end,
      body: entry.body,
      sent,
      settled: entry.settled === true,
      stale: entry.stale === true,
      asks: entry.asks === true,
      answers: entry.answers ?? [],
    }))

const notesFor = (state: TuiState, path: string): ReadonlyArray<Note> =>
  notesOf(state.sent, path, true, state.opened)

const paired = (chunks: ReadonlyArray<TextChunk>): ReadonlyArray<ReadonlyArray<TextChunk>> => {
  const chips: Array<ReadonlyArray<TextChunk>> = []
  for (let at = 0; at < chunks.length; at += CHIP_CHUNKS) {
    chips.push(chunks.slice(at, at + CHIP_CHUNKS))
  }
  return chips
}

const keptWithin = (chunks: ReadonlyArray<TextChunk>, room: number): ReadonlyArray<TextChunk> => {
  const kept: Array<ReadonlyArray<TextChunk>> = []
  let used = 0
  for (const chip of paired(chunks).toReversed()) {
    const width = chip.reduce((total, chunk) => total + chunk.text.length, 0)
    if (used + width > room) break
    kept.unshift(chip)
    used += width
  }
  return kept.flat()
}

const CHIP_CHUNKS = 3

const shortPath = (path: string): string => {
  const home = process.env["HOME"] ?? ""
  return home.length > 0 && path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

const KEPT_TAIL = 2
const HOME_PATH_MIN = 24
const HOME_PATH_CHROME = 10

const elide = (path: string, room: number): string => {
  if (path.length <= room) return path
  const parts = path.split("/").filter((part) => part.length > 0)
  const first = parts[0] ?? ""
  const name = parts.at(-1) ?? path
  const tail = parts.slice(-KEPT_TAIL).join("/")
  const rooted = path.startsWith("/") ? `/${first}` : path.startsWith("~") ? "~" : first
  const shorter = [`${rooted}/…/${tail}`, `…/${tail}`, `…/${name}`]
  return shorter.find((option) => option.length <= room) ?? clipMiddle(name, room)
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

const nameRoom = (pane: number): number => Math.max(BRANCH_NAME_MIN, pane - BRANCH_TAIL)

const columns = (cells: Cells, room: number): string =>
  `${clip(cells.name, room).padEnd(room)}${cells.files.padStart(5)}${cells.added.padStart(8)}${cells.gone.padStart(8)}  ${cells.layers.padStart(8)}   ${cells.state}`

const FORGE_SILENT = "  could not find out which of these have a pull request"

const unaskedForge = (state: TuiState): ReadonlyArray<TextChunk> =>
  state.forge === "silent" ? [fg(palette.faint)(`\n${FORGE_SILENT}`)] : []

const branchHeading = (room: number): string =>
  `  ${columns(
    { name: "WORKTREE", files: "FILES", added: "+", gone: "-", layers: "LAYERS", state: "STATE" },
    room,
  )}`

const atHome = (state: TuiState): boolean =>
  state.screen === "branches" ||
  ((state.screen === "palette" || state.screen === "keys") && state.returnTo === "branches")

const layersCell = (branch: TuiState["branches"][number]): string => {
  if (branch.layers === 0) return ""
  return branch.stale ? `${branch.layers} stale` : `${branch.layers} layers`
}

const baseLabel = (branch: TuiState["branches"][number]): string =>
  branch.basis === "default" ? "" : `on ${branch.base}`

const stateCell = (state: TuiState, branch: TuiState["branches"][number]): string =>
  [
    branch.own ? "here" : "",
    baseLabel(branch),
    state.pulls[branch.branch] ?? "",
    waitingLabel(branch).trim(),
  ]
    .filter((part) => part.length > 0)
    .join("  ")

const branchCells = (branch: TuiState["branches"][number], here: boolean, room: number) => ({
  lead: `${here ? marks().cursor : " "} `,
  name: clipMiddle(branch.branch, room).padEnd(room),
  files: `${branch.files}`.padStart(5),
  added: `+${branch.added}`.padStart(8),
  gone: `-${branch.removed}`.padStart(8),
  layers: layersCell(branch),
  state: "",
})

const headerParts = (
  state: TuiState,
  branch: string,
  path: string,
  pan: number,
): ReadonlyArray<string> => [
  branch,
  path,
  state.patches.length === 0 ? "nothing to read" : `${state.patchIndex + 1}/${state.patches.length}`,
  pullHere(state).length === 0 ? "" : `${pullHere(state)} pull request`,
  state.vouched.length === 0 ? "" : reviewedCount(state),
  contextLabel(state.context),
  hiddenLines(state) === 0 ? "" : `⋯ ${hiddenLines(state)} lines hidden`,
  pan === 0 ? "" : `→ ${pan} columns`,
]

const HEADER_GAP = 2
const HEADER_PATH_MIN = 20

const headerRoom = (width: number): number => Math.max(0, width - FRAME_PAD * 2 - GUTTER_X * 2)

const headerFitted = (
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

const fallbackScope = (state: TuiState, top: number): ReadonlyArray<string> => {
  const found = selectedPatch(state)?.hunks.findLast((hunk) => hunk.startRow < top)
  const scope = found?.scope ?? ""
  return scope.length === 0 ? [] : [scope]
}

const treeMarks = (state: TuiState, row: TreeRow): string => {
  const current = row.fileIndex === state.patchIndex
  const here = current ? (state.focus === "tree" ? "▸" : "·") : " "
  const seen = row.fileIndex !== undefined && isReviewed(state, row.fileIndex) ? marks().reviewed : " "
  return `${here}${seen}`
}

const treeTail = (state: TuiState, row: TreeRow): string => {
  if (row.fileIndex === undefined) return "  "
  const comments = commentsOn(state, row.fileIndex)
  return comments > 0 ? `${comments}${marks().tally}`.padStart(3) : "   "
}

const treeLine = (state: TuiState, row: TreeRow, pane: number): string => {
  const tail = treeTail(state, row)
  const room = Math.max(4, pane - PANE_CHROME - 2 - tail.length)
  return `${treeMarks(state, row)}${clip(treeLabel(state, row, room), room).padEnd(room)}${tail}`
}

const STEP_NUMBER = 3
const STEP_LEAD = 8
const NOTE_LEAD = 10
const STEP_GAP = 1
const STALE_ROOM = 13

type LayerRoom = { readonly title: number; readonly note: number; readonly tally: number }

const STALE_LONG = "stale, the branch moved on"
const STALE_SHORT = "stale"

const staleBanner = (room: number): string =>
  wrapped(room >= STALE_ROOM ? STALE_LONG : STALE_SHORT, room)
    .map((line) => `  ${line}`)
    .join("\n")

const layerRoom = (state: TuiState, pane: number): LayerRoom => {
  const tally = Math.max(1, ...state.layers.map((layer) => `${layer.files.length}`.length))
  return {
    title: Math.max(4, pane - PANE_CHROME - STEP_LEAD - STEP_GAP - tally),
    note: Math.max(4, pane - PANE_CHROME - NOTE_LEAD),
    tally,
  }
}

const layerFold = (state: TuiState, index: number): string => {
  if (layerOpen(state, index)) return "▾"
  return (state.layers[index]?.note ?? "").length === 0 ? " " : "▸"
}

const layerHead = (state: TuiState, row: LayerRow): string => {
  if (!row.lead) return " ".repeat(STEP_LEAD)
  const here = row.index === state.layerIndex
  const mark = here ? (state.focus === "tree" ? "▸" : "·") : " "
  return `${mark} ${layerFold(state, row.index)} ${`${row.index + 1}.`.padStart(STEP_NUMBER)} `
}

const layerText = (state: TuiState, row: LayerRow, room: LayerRoom): string => {
  if (row.kind === "file") return `${" ".repeat(NOTE_LEAD)}${marks().file} ${row.text}`
  if (row.kind === "note") return `${" ".repeat(NOTE_LEAD)}${row.text}`
  const count = row.lead ? `${state.layers[row.index]?.files.length ?? 0}` : ""
  const tail = count.padStart(room.tally + STEP_GAP)
  return `${layerHead(state, row)}${row.text.padEnd(room.title)}${tail}`
}

const layerPaint = (state: TuiState, row: LayerRow): string => {
  if (row.kind === "file") return palette.ink
  if (row.kind === "note") return palette.faint
  return row.index === state.layerIndex ? palette.ink : palette.muted
}

const PANEL_TITLES: Readonly<Record<PanelSection, string>> = {
  with: "With the agent",
  answered: "Answered",
}

const PANEL_ORDER: ReadonlyArray<PanelSection> = ["with", "answered"]
const PANEL_LEAD = 3
const PANEL_EMPTY = "No comment on this branch yet."

type PanelLine = { readonly text: string; readonly tone: string; readonly here?: boolean }

const panelMark = (state: TuiState, at: number): string => {
  if (at !== state.panelIndex) return " "
  return state.focus === "review" ? "▸" : "·"
}

const panelWhere = (entry: PanelEntry, room: number): string => {
  const where = `:${entry.comment.end}`
  return `${clipPath(entry.comment.file, Math.max(4, room - where.length))}${where}`
}

const panelBody = (entry: PanelEntry): string =>
  entry.comment.body.split("\n").find((line) => line.trim().length > 0) ?? ""

type Placed = { readonly entry: PanelEntry; readonly at: number }

const panelPair = (state: TuiState, placed: Placed, room: number): ReadonlyArray<PanelLine> => {
  const { entry } = placed
  const lead = `${panelMark(state, placed.at)}${entry.fresh || entry.unread > 0 ? marks().comment : " "} `
  const here = placed.at === state.panelIndex
  return [
    { text: `${lead}${panelWhere(entry, room - PANEL_LEAD)}`, tone: palette.ink, here },
    { text: `   ${clip(panelBody(entry), Math.max(4, room - PANEL_LEAD))}`, tone: palette.muted, here },
  ]
}

const panelSection = (
  state: TuiState,
  placed: ReadonlyArray<Placed>,
  section: PanelSection,
  room: number,
): ReadonlyArray<PanelLine> => {
  const here = placed.filter((one) => one.entry.section === section)
  if (here.length === 0) return []
  return [
    { text: "", tone: palette.faint },
    { text: `${PANEL_TITLES[section]}  ${here.length}`, tone: palette.faint },
    ...here.flatMap((one) => panelPair(state, one, room)),
  ]
}

const PULL_HINT = "answered, press r to pull"

const panelText = (state: TuiState, room: number): StyledText => {
  const placed = panelEntries(state).map((entry, at): Placed => ({ entry, at }))
  const fresh = placed.filter((one) => one.entry.fresh).length
  const unread = placed.filter((one) => one.entry.unread > 0).length
  const said = fresh > 0 ? `${fresh} ${PULL_HINT}` : unread > 0 ? `${unread} unread` : ""
  const banner: ReadonlyArray<PanelLine> =
    said.length === 0 ? [] : [{ text: clip(said, room), tone: palette.attention }]
  const sections = PANEL_ORDER.flatMap((section) => panelSection(state, placed, section, room))
  const body = sections.slice(sections[0]?.text === "" ? 1 : 0)
  const lines = body.length === 0 ? [{ text: PANEL_EMPTY, tone: palette.muted }] : body
  return new StyledText(
    [...banner, ...lines].map((line) => {
      const drawn = fg(line.tone)(`${line.text.padEnd(room)}\n`)
      return line.here === true ? bg(palette.selection)(drawn) : drawn
    }),
  )
}

export type Mouse = {
  readonly onScroll: (delta: number) => void
  readonly onPan: (delta: number) => void
  readonly onDrag: (from: Spot, to: Spot, done: boolean) => void
  readonly onChip: (key: string) => void
  readonly onRail: (delta: number) => void
}

export class Screen {
  private readonly header: TextRenderable
  private readonly body: BoxRenderable
  private readonly listPane: BoxRenderable
  private readonly list: TextRenderable
  private readonly diffPane: BoxRenderable
  private readonly panelPane: BoxRenderable
  private readonly panel: TextRenderable
  private readonly scrim: BoxRenderable
  private readonly gutter: TextRenderable
  private readonly diffScroll: BoxRenderable
  private readonly view: DiffView
  private readonly compose: BoxRenderable
  private readonly repo: string
  private readonly logo: ASCIIFontRenderable
  private readonly landing: TextRenderable
  private readonly landingKeys: TextRenderable
  private hovered = -1
  private lead = 0
  private shown: TuiState | undefined
  private chips: ReadonlyArray<{ key: string; hint: string; press: string }> = []
  private readonly composeTitle: TextRenderable
  private readonly composeBody: TextRenderable
  private readonly composeActions: TextRenderable
  private readonly footer: TextRenderable
  private readonly palette: BoxRenderable
  private readonly paletteTitle: TextRenderable
  private readonly paletteQuery: TextRenderable
  private readonly paletteChoices: TextRenderable
  private readonly keys: BoxRenderable
  private readonly keysTitle: TextRenderable
  private readonly keysQuery: TextRenderable
  private readonly keysChoices: TextRenderable
  private readonly found: BoxRenderable
  private readonly foundTitle: TextRenderable
  private readonly foundPeek: TextRenderable
  private readonly foundChoices: TextRenderable

  private readonly renderer: CliRenderer

  private mouse: Mouse | undefined
  private dragFrom: Spot | undefined
  private lastTop = 0

  constructor(renderer: CliRenderer, repo = "") {
    this.renderer = renderer
    this.repo = repo
    renderer.root.flexDirection = "column"
    renderer.root.paddingLeft = FRAME_PAD
    renderer.root.paddingRight = FRAME_PAD
    renderer.root.paddingTop = 0
    renderer.root.paddingBottom = 0

    this.header = bar(renderer, "header", palette.ink)
    this.footer = bar(renderer, "footer", palette.faint)
    this.body = makeBody(renderer)
    const list = makeListParts(renderer)
    this.listPane = list.pane
    this.list = list.text
    const home = makeHome(renderer)
    this.logo = home.logo
    this.landing = home.path
    this.landingKeys = home.keys
    this.diffPane = makeDiffPane(renderer)
    const panel = makePanel(renderer)
    this.panelPane = panel.pane
    this.panel = panel.text
    this.diffScroll = makeScroll(renderer)
    this.view = new DiffView(renderer)
    const inside = makeComposeParts(renderer)
    this.compose = makeCompose(renderer)
    this.composeTitle = inside.title
    this.composeBody = inside.body
    this.composeActions = inside.actions
    this.scrim = makeScrim(renderer)
    this.gutter = makeGutter(renderer)
    const modals = makeModals(renderer)
    this.palette = modals.palette.box
    this.paletteTitle = modals.palette.title
    this.paletteQuery = modals.palette.query
    this.paletteChoices = modals.palette.choices
    this.keys = modals.keys.box
    this.keysTitle = modals.keys.title
    this.keysQuery = modals.keys.query
    this.keysChoices = modals.keys.choices
    this.found = modals.found.box
    this.foundTitle = modals.found.title
    this.foundPeek = modals.found.query
    this.foundChoices = modals.found.choices

    this.assemble(renderer)
  }

  private wheelOnRail(box: BoxRenderable | TextRenderable): void {
    box.onMouseScroll = (event: { scroll?: { direction?: string } }) => {
      const way = event.scroll?.direction
      if (way !== "up" && way !== "down") return
      this.mouse?.onRail(way === "down" ? 1 : -1)
    }
  }

  private wheelOnSheet(box: BoxRenderable): void {
    box.onMouseScroll = (event: { scroll?: { direction?: string } }) => {
      const way = event.scroll?.direction
      if (way !== "up" && way !== "down") return
      this.mouse?.onScroll(way === "down" ? 1 : -1)
    }
  }

  listen(mouse: Mouse): void {
    this.mouse = mouse
    this.wheelOnSheet(this.keys)
    this.wheelOnSheet(this.palette)
    this.wheelOnRail(this.listPane)
    this.wheelOnRail(this.list)
    this.view.listenTo({
      scroll: (delta) => {
        this.dragFrom = undefined
        this.mouse?.onScroll(delta)
      },
      pan: (delta) => this.mouse?.onPan(delta),
      down: (y, x) => {
        this.dragFrom = this.spotAt(y, x)
        this.mouse?.onDrag(this.dragFrom, this.dragFrom, false)
      },
      drag: (y, x) => {
        if (this.dragFrom === undefined) return
        this.mouse?.onDrag(this.dragFrom, this.spotAt(y, x), false)
      },
      dragEnd: (y, x) => {
        if (this.dragFrom === undefined) return
        this.mouse?.onDrag(this.dragFrom, this.spotAt(y, x), true)
        this.dragFrom = undefined
      },
    })
  }

  private rowAtY(y: number): number {
    return this.view.rowAt(Math.max(0, y - this.view.screenTop() + this.lastTop))
  }

  private spotAt(y: number, x: number): Spot {
    return { row: this.rowAtY(y), column: this.view.columnAt(x) }
  }

  viewportRows(): number {
    const edges = this.diffPane.border === true ? PANE_EDGES : 0
    const pane = this.diffPane.height - edges - STICKY_MAX
    return Math.max(1, pane > 0 ? pane : this.diffRows())
  }

  lit(
    path: string,
    side: "new" | "old",
    lines: ReadonlyArray<string>,
    found: ReadonlyArray<readonly [number, number, string, unknown?]>,
  ): void {
    this.view.lit(path, side, lines, found)
  }

  noteRoom(): number {
    return this.view.room()
  }

  tallestRows(): number {
    return this.view.tallestRows()
  }

  railRows(): number {
    return this.listRoom()
  }

  scrolledAt(): number {
    return this.lastTop
  }

  rowAtScreen(visual: number): number {
    return this.view.rowAt(visual)
  }

  screenRowOf(row: number): number | undefined {
    return this.view.screenRowOf(row)
  }

  blockAt(row: number, stop: number): { readonly start: number; readonly rows: number } {
    return this.view.blockAt(row, stop)
  }

  private diffRows(): number {
    const edges = this.diffPane.border === true ? PANE_EDGES : 0
    const pane = this.diffPane.height - edges - this.view.pinRows()
    return Math.max(1, pane > 0 ? pane : this.diffScroll.height)
  }

  update(state: TuiState): void {
    this.shown = state
    this.chips = hintsFor(state.screen, {
      comments: state.sent.length,
      layers: state.layers.length,
      onThread: state.stop > 0 || threadChosen(state) !== undefined,
      selecting: state.selecting,
      reviewed: reviewedCountIn(state),
      pull: pullHere(state).length > 0,
      pane: state.screen === "review" ? state.focus : "diff",
    })
    this.header.content = this.headerText(state)
    this.footer.content = this.footerText(state)
    this.list.content = this.listText(state)
    const many = state.branches.length === 1 ? "1 worktree" : `${state.branches.length} worktrees`
    const pane = this.homeRoom(state)
    const room = Math.max(HOME_PATH_MIN, pane - many.length - HOME_PATH_CHROME)
    this.landing.content = `${elide(shortPath(this.repo), room)}  ·  ${many}`
    this.landingKeys.content = this.homeKeys(state)
    this.diffPane.visible = state.screen !== "branches" && !atHome(state)
    if (this.diffPane.visible) this.paintDiff(state)
    this.paintPanel(state)
    this.paintPane(state)
    this.paintCompose(state)
    this.paintPalette(state)
    this.paintKeys(state)
    this.paintFound(state)
    this.paintReport(state)
    this.scrim.visible = state.screen !== "branches" && state.screen !== "review"
  }

  private paintPalette(state: TuiState): void {
    this.palette.visible = state.screen === "palette"
    if (state.screen !== "palette") {
      this.paletteQuery.content = ""
      this.paletteTitle.content = ""
      this.paletteChoices.content = ""
      return
    }
    const matches = paletteMatches(state)
    this.paletteTitle.content = matches.length === 0 ? "No command matches" : "Commands"
    this.paletteQuery.content =
      state.query.length === 0 ? "Type to filter…" : `${state.query}▏`
    const room = panelWidth(this.renderer.width)
    const paletteRoom = Math.min(
      panelRows(this.renderer.height, PANEL_QUARTER),
      matches.length + PALETTE_CHROME,
    )
    this.paletteChoices.content = listText(
      matches.map((entry) => commandRow(entry, room - MODAL_ROOM)),
      Math.min(state.paletteIndex, Math.max(0, matches.length - 1)),
      paletteRoom - PALETTE_CHROME,
    )
    this.palette.height = paletteRoom
    this.palette.width = room
    this.palette.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.palette.top = panelTop(this.renderer.height, PANEL_QUARTER)
  }

  private paintKeys(state: TuiState): void {
    this.keys.visible = state.screen === "keys"
    if (state.screen !== "keys") {
      this.keysTitle.content = ""
      this.keysQuery.content = ""
      this.keysChoices.content = ""
      return
    }
    const rows = keyMatches(state)
    const room = panelWidth(this.renderer.width)
    this.keysTitle.content =
      rows.length === 0 ? "No key matches" : `Keys here, ${rows.length} of them`
    this.keysQuery.content = state.query.length === 0 ? "Type to filter…" : `${state.query}▏`
    const keysRoom = Math.min(
      panelRows(this.renderer.height, PANEL_QUARTER),
      rows.length + PENDING_CHROME,
    )
    this.keysChoices.content = listText(
      rows.map((entry) => commandRow(entry, room - MODAL_ROOM)),
      Math.min(state.paletteIndex, Math.max(0, rows.length - 1)),
      keysRoom - PENDING_CHROME,
    )
    this.keys.height = keysRoom
    this.keys.width = room
    this.keys.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.keys.top = panelTop(this.renderer.height, PANEL_QUARTER)
  }

  private headerText(state: TuiState): StyledText {
    const branch = selectedBranch(state)
    if (atHome(state)) {
      return t`${fg(palette.faint)("")}`
    }
    const path = selectedPatch(state)?.path ?? ""
    const parts = headerParts(
      state,
      branch?.branch ?? "",
      path,
      Math.min(state.pan, this.view.panLimit()),
    ).filter((part) => part.length > 0)
    const [name = "", ...rest] = headerFitted(parts, path, headerRoom(this.renderer.width))
    return t`${fg(palette.ink)(name)}  ${fg(palette.muted)(rest.join("  "))}`
  }

  private footerText(state: TuiState): StyledText {
    const readout = selectionReadout(state)
    this.lead = readout.length === 0 ? 0 : readout.length + 3
    const lead = readout.length === 0 ? [] : [fg(palette.muted)(`${readout}   `)]
    const said = state.notice.length === 0 ? state.waiting : state.notice
    const tail = said.length === 0 ? "" : `  ${said}`
    const width = this.footer.width > 0 ? this.footer.width : this.renderer.width
    const room = Math.max(0, width - this.lead - tail.length)
    const chips = keptWithin(this.chipRow().chunks, room)
    const colour = state.notice.length === 0 ? palette.accent : palette.attention
    const notice = tail.length === 0 ? [] : [fg(colour)(tail)]
    return new StyledText([...lead, ...chips, ...notice])
  }

  private paneRoom(): number {
    return treeWidth(this.renderer.width)
  }

  columns(): number {
    return this.renderer.width
  }

  private paintPanel(state: TuiState): void {
    const shown = this.diffPane.visible && panelShown(state)
    this.panelPane.visible = shown
    this.panelPane.width = shown ? reviewWidth() : 0
    this.panelPane.paddingLeft = shown ? 1 : 0
    this.panelPane.paddingTop = 0
    this.panel.content = shown ? panelText(state, reviewWidth() - PANE_CHROME) : ""
  }

  private listText(state: TuiState): string | StyledText {
    if (atHome(state)) return this.branchTable(state)
    if (onLayers(state)) return this.layerRail(state)
    const room = this.listRoom()
    const pane = this.paneRoom()
    const whole = treeWindow(state, room)
    const window = whole.more === 0 ? whole : treeWindow(state, Math.max(1, room - 1))
    const rows = window.rows.flatMap((row) => {
      const drawn = fg(row.kind === "file" ? palette.ink : palette.muted)(
        `${treeLine(state, row, pane)}\n`,
      )
      return [row.fileIndex === state.patchIndex ? bg(palette.selection)(drawn) : drawn]
    })
    const more = window.more > 0 ? [fg(palette.faint)(` … ${window.more} more`)] : []
    return new StyledText([...rows, ...more])
  }

  private listRoom(): number {
    const edges = this.listPane.border === true ? PANE_EDGES : PANE_INSET
    return Math.max(1, this.listPane.height - edges)
  }

  private layerRail(state: TuiState): StyledText {
    const banner = state.layersStale ? 1 : 0
    const height = Math.max(1, this.listRoom() - banner)
    const room = layerRoom(state, this.paneRoom())
    const all = layerRows(state, room.title, room.note)
    const whole = railWindow(all, height, state.layerIndex)
    const window =
      whole.more === 0 ? whole : railWindow(all, Math.max(1, height - 1), state.layerIndex)
    const rows = window.rows.map((row) =>
      fg(layerPaint(state, row))(`${layerText(state, row, room)}\n`),
    )
    const more = window.more > 0 ? [fg(palette.faint)(` … ${window.more} more`)] : []
    const warn = state.layersStale
      ? [fg(palette.attention)(`${staleBanner(room.note)}\n`)]
      : []
    return new StyledText([...warn, ...rows, ...more])
  }

  private paintDiff(state: TuiState): void {
    const shown = shownOf(state)
    if (shown === undefined) return
    const patch = shown.patch
    this.view.setWrap(state.wrap)
    this.view.setPan(state.pan)
    this.view.show(patch, notesFor(state, patch.path), gapRowSet(shown), proseFor(state, patch.path))
    this.view.pick(state.picked)
    if (!takesText(state.screen)) {
      this.view.fit(this.diffRows())
      this.lastTop = this.view.scrollTo(state.top, state.cursor, state.scroll)
      if (state.sticky) this.paintSticky(state, this.view.rowAt(this.lastTop))
      else this.view.pin([])
    }
    const top = this.lastTop
    this.view.paint(this.linePaint(state), top, this.view.rows())
    this.paintGutter(state, top, this.view.rows())
  }

  private assemble(renderer: CliRenderer): void {
    this.diffScroll.add(this.view.node())
    this.diffPane.add(this.view.pinNode())
    this.diffPane.add(makeScroller(renderer, this.gutter, this.diffScroll))
    this.listPane.insertBefore(this.landing, this.list)
    this.listPane.insertBefore(this.logo, this.landing)
    this.listPane.add(this.landingKeys)
    this.watchChips()
    this.body.add(this.listPane)
    this.body.add(this.diffPane)
    this.body.add(this.panelPane)
    stack(this.compose, [this.composeTitle, this.composeBody, this.composeActions])
    stack(renderer.root, [
      this.header,
      this.body,
      this.footer,
      this.scrim,
      this.compose,
      this.palette,
      this.found,
      this.keys,
    ])
  }

  private watchChips(): void {
    const strip = this.footer
    strip.onMouseMove = (event: { x: number }) => this.hover(event.x - strip.x - this.lead)
    strip.onMouseOut = () => this.hover(-1)
    strip.onMouseDown = (event: { x: number }) => {
      this.hover(event.x - strip.x - this.lead)
      const chip = this.chips[this.hovered]
      if (chip !== undefined) this.mouse?.onChip(chip.press)
    }
    const row = this.landingKeys
    row.onMouseMove = (event: { x: number }) => this.hover(event.x - row.x)
    row.onMouseOut = () => this.hover(-1)
    row.onMouseDown = (event: { x: number }) => {
      this.hover(event.x - row.x)
      const chip = this.chips[this.hovered]
      if (chip !== undefined) this.mouse?.onChip(chip.press)
    }
  }

  private branchTable(state: TuiState): StyledText {
    const room = nameRoom(this.homeRoom(state))
    if (state.branches.length === 0) return new StyledText([fg(palette.muted)(EMPTY_LIST)])
    const heading = [fg(palette.faint)(`${branchHeading(room)}\n\n`)]
    const rows = state.branches.flatMap((branch, index) => {
      const here = index === state.branchIndex
      const cells = branchCells(branch, here, room)
      return [
        fg(palette.accent)(cells.lead),
        fg(here ? palette.ink : palette.muted)(cells.name),
        fg(palette.faint)(cells.files),
        fg(palette.added)(cells.added),
        fg(palette.removed)(cells.gone),
        fg(palette.accent)(`  ${cells.layers.padStart(8)}`),
        fg(palette.attention)(`   ${stateCell(state, branch)}\n`),
      ]
    })
    return new StyledText([...heading, ...rows, ...unaskedForge(state)])
  }

  private hover(x: number): void {
    let at = 0
    const found = this.chips.findIndex((chip) => {
      const width = `${chip.key} ${chip.hint}`.length + CHIP_GAP
      const here = x >= at && x < at + width
      at += width
      return here
    })
    if (found === this.hovered) return
    this.hovered = found
    this.landingKeys.content = this.chipRow()
    if (this.shown !== undefined) this.footer.content = this.footerText(this.shown)
  }

  private homeRoom(state: TuiState): number {
    return homeWidth(this.renderer.width, longestName(state))
  }

  private homeKeys(state: TuiState): StyledText {
    const said = state.notice.length === 0 ? state.waiting : state.notice
    const tail = said.length === 0 ? "" : `  ${said}`
    const room = Math.max(0, this.homeRoom(state) - tail.length)
    const chips = keptWithin(this.chipRow().chunks, room)
    if (tail.length === 0) return new StyledText([...chips])
    const colour = state.notice.length === 0 ? palette.accent : palette.attention
    return new StyledText([...chips, fg(colour)(tail)])
  }

  private chipRow(): StyledText {
    return new StyledText(
      this.chips.flatMap((chip, index) => {
        const lit = index === this.hovered
        const key = fg(palette.ink)(chip.key)
        const hint = fg(lit ? palette.ink : palette.faint)(` ${chip.hint}`)
        return [
          lit ? bg(palette.cursor)(key) : key,
          lit ? bg(palette.cursor)(hint) : hint,
          fg(palette.faint)("   "),
        ]
      }),
    )
  }

  private paintPane(state: TuiState): void {
    const onBranches = atHome(state)
    const inset = onBranches ? 0 : 1
    this.listPane.width = onBranches ? this.homeRoom(state) : this.paneRoom()
    this.listPane.visible = onBranches || state.navOpen
    this.listPane.paddingLeft = inset
    this.listPane.paddingRight = 0
    this.listPane.paddingTop = 0
    this.listPane.marginRight = 0
    this.diffPane.paddingLeft = inset
    this.list.flexGrow = inset
    this.paintFocus(state, onBranches)
    this.paintChrome(onBranches)
  }

  private paintFocus(state: TuiState, onBranches: boolean): void {
    const lit = (held: TuiState["focus"]): string =>
      !onBranches && state.focus === held ? palette.accent : palette.rule
    for (const pane of [this.listPane, this.diffPane, this.panelPane]) {
      pane.border = onBranches ? [] : true
      pane.borderStyle = "rounded"
    }
    this.listPane.borderColor = onBranches ? palette.rule : lit("tree")
    this.diffPane.borderColor = lit("diff")
    this.panelPane.borderColor = lit("review")
  }

  private paintChrome(onBranches: boolean): void {
    const place = onBranches ? "center" : "flex-start"
    this.body.border = []
    this.listPane.backgroundColor = "transparent"
    this.logo.visible = onBranches
    this.landing.visible = onBranches
    this.landingKeys.visible = onBranches
    this.footer.visible = !onBranches
    this.body.justifyContent = place
    this.listPane.justifyContent = place
  }

  private paintFound(state: TuiState): void {
    this.found.visible = state.screen === "search"
    if (state.screen !== "search") {
      this.foundTitle.content = ""
      this.foundPeek.content = ""
      this.foundChoices.content = ""
      return
    }
    const room = panelWidth(this.renderer.width)
    const here = matchHere(state)
    this.foundTitle.content = `${state.term}  ·  ${state.matches.length} elsewhere`
    const peekHigh = here?.around.length ?? 0
    const foundRoom = Math.min(
      panelRows(this.renderer.height, PANEL_FIFTH),
      state.matches.length + peekHigh + PALETTE_CHROME,
    )
    this.foundChoices.content = listText(
      state.matches.map((match) =>
        clip(
          `${match.changed ? marks().comment : " "} ${match.path}:${match.line}  ${match.text}`,
          Math.max(1, room - MODAL_ROOM),
        ),
      ),
      state.matchIndex,
      Math.max(1, foundRoom - peekHigh - PALETTE_CHROME),
    )
    this.foundPeek.content = (here?.around ?? [])
      .map((line) => clip(line, Math.max(1, room - MODAL_ROOM)))
      .join("\n")
    const peekRows = here?.around.length ?? 0
    this.foundPeek.height = peekRows
    this.found.height = Math.min(
      panelRows(this.renderer.height, PANEL_FIFTH),
      state.matches.length + peekRows + PALETTE_CHROME,
    )
    this.found.width = room
    this.found.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.found.top = panelTop(this.renderer.height, PANEL_FIFTH)
  }

  private paintReport(state: TuiState): void {
    this.compose.visible = state.screen === "compose" || state.screen === "report"
    if (state.screen !== "report") return
    const room = composeRoom(this.renderer.width)
    const asked = state.reportFull
      ? "What went wrong? Everything on screen is attached for you."
      : "What went wrong? Only what you type is sent."
    const written = draftText(state, room.text)
    const lead = laidOut([asked, ""], room.text)
    this.composeTitle.content = "Report a bug"
    this.composeBody.content = new StyledText([
      ...lead.map((line) => fg(palette.muted)(`${line}\n`)),
      ...written.rows,
    ])
    this.composeActions.content = reportActions(state.reportFull)
    this.compose.height = lead.length + written.height + COMPOSE_ACTION_ROWS + COMPOSE_CHROME
    this.compose.width = room.box
    this.compose.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room.box) / 2))
    this.compose.top = Math.max(2, Math.floor(this.renderer.height / 4))
  }

  private paintGutter(state: TuiState, top: number, height: number): void {
    const [from, to] = selectionRange(state)
    const marked = markedRows(state)
    const drawn = this.view.drawn()
    const bare = (visual: number): boolean =>
      visual >= drawn || !this.view.carries(visual) || this.view.isRunOn(visual)
    const held = (visual: number): string => {
      const row = this.view.rowAt(visual)
      const onCode = this.view.stopAt(visual) === 0
      const standing = row === state.cursor && this.view.stopAt(visual) === state.stop
      const within = onCode && inRange(state, row, from, to)
      return `${standing || within ? marks().cursor : " "}${onCode && marked.has(row) ? marks().comment : " "}`
    }
    const rows = Array.from({ length: height }, (_, index) =>
      bare(top + index) ? "  " : held(top + index),
    )
    this.gutter.content = rows.join("\n")
  }

  private paintSticky(state: TuiState, top: number): void {
    const line = newLineAt(state, top)
    const chain =
      line === undefined || state.source.length === 0
        ? fallbackScope(state, top)
        : stickyChain(state.source, line, STICKY_MAX)
    this.view.pin(chain)
  }

  private linePaint(state: TuiState): (row: number) => LinePaint | undefined {
    const [from, to] = selectionRange(state)
    const selecting = state.selecting || state.screen === "compose"
    const shown = shownOf(state)
    const rows = shown?.patch.rows ?? []
    const gaps = shown === undefined ? new Set<number>() : gapRowSet(shown)
    return (row) => {
      const kind = rows[row]?.kind
      if (kind === undefined) return undefined
      return pickPaint(this.view, kind, {
        cursor: row === state.cursor,
        selected: selecting && row >= from && row <= to,
        gap: gaps.has(row),
      })
    }
  }

  private paintCompose(state: TuiState): void {
    this.compose.visible = state.screen === "compose"
    if (state.screen !== "compose") {
      this.composeBody.content = ""
      return
    }
    const room = composeRoom(this.renderer.width)
    const snippet = snippetOf(state, SNIPPET_LINES)
    const more = selectedLineCount(state) - snippet.length
    const tail = more > 0 ? [`     … ${more} more lines`] : []
    const quoted = [...snippet, ...tail].map((line) => clip(line, room.text))
    const written = draftText(state, room.text)
    this.composeTitle.content = clip(composeTarget(state), room.text)
    this.composeBody.content = new StyledText([
      ...[...quoted, ""].map((line) => fg(palette.muted)(`${line}\n`)),
      ...written.rows,
    ])
    this.composeActions.content = actionsText()
    const height = quoted.length + 1 + written.height + COMPOSE_ACTION_ROWS + COMPOSE_CHROME
    this.compose.height = height
    this.compose.width = room.box
    this.compose.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room.box) / 2))
    this.compose.top = Math.max(2, Math.floor((this.renderer.height - height) / 2))
  }
}
