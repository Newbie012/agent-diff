import {
  BoxRenderable,
  RGBA,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core"
import {
  ASCIIFontRenderable,
  bg,
  fg,
  StyledText,
  t,
  TextareaRenderable,
  defaultTextareaKeyBindings,
  type KeyBinding,
  type TextChunk,
} from "@opentui/core"
import { absurd } from "effect"
import { displayKey, hintsFor, takesText, type Command, type Offered } from "./command.ts"
import { REMAINDER_TITLE } from "../domain/layers/index.ts"
import { stickyChain, type RowKind } from "../domain/patch/index.ts"
import {
  ANSWER_MARK,
  DiffView,
  REPLY_MARK,
  type Draft,
  type LinePaint,
  type Note,
} from "./diffview.ts"
import { gapRowSet, shownOf } from "./gaps.ts"
import { keyMatches, paletteMatches } from "./reduce.ts"
import {
  composeTarget,
  draftPlace,
  filePlace,
  hiddenLines,
  isReviewed,
  markedStands,
  newLineAt,
  onLayers,
  railWindow,
  selectionReadout,
  layerDone,
  layerFitted,
  layerRoomIn,
  RAIL_DIR_LEAD,
  RAIL_FILE_LEAD,
  RAIL_GUTTER,
  RAIL_TITLE_LEAD,
  type LayerRoom,
  type RailWindow,
  preferenceRows,
  standingOnThread,
  askedRows,
  asksAbout,
  type LayerRow,
  type PreferenceRow,
  wrapped,
  selectedLineCount,
  snippetOf,
  threadQuote,
  reviewedCount,
  reviewedCountIn,
  pullHere,
  selectedBranch,
  selectedPatch,
  selectionRange,
  threadHere,
  threadStand,
  threadsOn,
  treeWindow,
  tooSmall,
  treeWidth,
  type TuiState,
  WHOLE_FILE,
  clip,
  FRAME_PAD,
  type StagedComment,
  proseFor,
  composeBox,
  composeRoom as composeText,
  panelEntries,
  panelEntry,
  picking,
  refsShown,
  remarkQuote,
  remarkShown,
  remarkToTakeOn,
  remarkUnderCursor,
  panelShown,
  shownMatches,
  reviewWidth,
  type PanelEntry,
  PANEL_SECTIONS,
  type PanelSection,
  type Spot,
  laidDraft,
  panelHolds,
  type Clicked,
  refSaidOf,
} from "./model.ts"
import type { TreeRow } from "./tree.ts"
import type {
  Match,
  Remark,
} from "../review/index.ts"
import { marks, standMark, type MarkSet } from "./marks.ts"
import { palette } from "./theme.ts"

const ROW_HEIGHT = 1
const COMPOSE_WIDTH = 72
const GUTTER_X = 2
const CHIP_GAP = 4
const MODAL_ROOM = 8
const COMPOSE_CHROME = 3
const DRAFT_PAD = 2
const NOTE_ROOM_MIN = 24
const DRAFT_ROOM = 6
const DRAFT_HEAD = 1
const COMPOSE_ACTION_ROWS = 2

const reportActions = (full: boolean): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^t")} ${fg(palette.muted)(full ? "sending everything" : "sending the least")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)("copy and save")}`

const SENDS = "send it"
const REPLIES = "reply on the pull request"

const actionsText = (said: string): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)(said)}`
const SNIPPET_LINES = 4
const PALETTE_KEY = 11
const PALETTE_TITLE = 60
const PALETTE_GAP = 2
const PALETTE_CHROME = 4
const PENDING_CHROME = 4
const LEGEND_ROWS = 1

const LEGEND: ReadonlyArray<readonly [keyof MarkSet, string]> = [
  ["filed", "written"],
  ["waiting", "picked up"],
  ["answered", "answered"],
  ["asked", "waiting on you"],
  ["done", "settled"],
]

const legendText = (room: number): string => {
  const said = LEGEND.map(([key, means]) => `${marks()[key]} ${means}`)
  const voices = [`${REMARK_MARK} remark`, `${REPLY_MARK} you`, `${ANSWER_MARK} the agent`]
  return clip([...said, ...voices].join("   "), room)
}

const keysTitle = (found: number, whole: boolean): string => {
  if (found === 0) return "No key matches"
  return whole ? `Keys here, ${found} of them` : `Keys here, ${found} of them — arrows for the rest`
}
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
const DIFF_FLOOR = 24
const COMPOSE_EDGE = 4
const CRAMPED = "adiff needs more room than this"
const CRAMPED_ROWS = 4
const DIFF_CHROME_MOST = 16
const BRANCH_WIDTH = 82
const BRANCH_NAME_MIN = 12
const BRANCH_FIXED = 36
const STATE_MIN = 11
const EMPTY_LIST = "  nothing to review. No branch differs from the one it started from."
const MODAL_MARGIN = 4

const shareOf = (width: number, least: number): number =>
  Math.max(least, Math.min(PANEL_MAX, Math.floor(width * PANEL_SHARE)))

const homeWidth = (width: number, longest: number, said = STATE_MIN): number =>
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

const longestName = (state: TuiState): number =>
  Math.max(0, ...state.branches.map((branch) => branch.branch.length))

const longestState = (state: TuiState): number =>
  Math.max(0, ...state.branches.map((branch) => stateCell(state, branch).length))

const keysOf = (entry: Command): string =>
  entry.keys.map((one) => displayKey(one)).join(" ")

const commandRow = (entry: Command, room: number): string => {
  const key = clip(keysOf(entry), PALETTE_KEY - PALETTE_GAP).padEnd(PALETTE_KEY)
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
  if (flags.cursor) return UNDER_CURSOR[kind] ?? PLAIN_CURSOR
  if (flags.selected) return PICKED[kind] ?? PLAIN_PICKED
  if (flags.gap) return GAP_PAINT
  return view.washOf(kind)
}

const PLAIN_PICKED: LinePaint = {
  gutter: RGBA.fromHex(palette.pickedGutter),
  content: RGBA.fromHex(palette.pickedOn),
}

const PICKED: Partial<Record<RowKind, LinePaint>> = {
  added: {
    gutter: RGBA.fromHex(palette.pickedGutterAdded),
    content: RGBA.fromHex(palette.pickedOnAdded),
  },
  removed: {
    gutter: RGBA.fromHex(palette.pickedGutterRemoved),
    content: RGBA.fromHex(palette.pickedOnRemoved),
  },
}

const PLAIN_CURSOR: LinePaint = {
  gutter: RGBA.fromHex(palette.cursorGutter),
  content: RGBA.fromHex(palette.cursorOn),
}

const UNDER_CURSOR: Partial<Record<RowKind, LinePaint>> = {
  added: {
    gutter: RGBA.fromHex(palette.cursorGutterAdded),
    content: RGBA.fromHex(palette.cursorOnAdded),
  },
  removed: {
    gutter: RGBA.fromHex(palette.cursorGutterRemoved),
    content: RGBA.fromHex(palette.cursorOnRemoved),
  },
}
const GAP_PAINT: LinePaint = {
  gutter: RGBA.fromHex(palette.overlay),
  content: RGBA.fromHex(palette.overlay),
}

const frameRoot = (renderer: CliRenderer): void => {
  renderer.root.flexDirection = "column"
  renderer.root.paddingLeft = FRAME_PAD
  renderer.root.paddingRight = FRAME_PAD
  renderer.root.paddingTop = 0
  renderer.root.paddingBottom = 0
}

const crampedBar = (renderer: CliRenderer): TextRenderable => {
  const made = bar(renderer, "cramped", palette.muted)
  made.wrapMode = "word"
  made.height = CRAMPED_ROWS
  return made
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
  readonly query: TextareaRenderable
  readonly choices: TextRenderable
}

type KeysParts = PaletteParts & { readonly legend: TextRenderable }

type FoundParts = {
  readonly box: BoxRenderable
  readonly title: TextRenderable
  readonly query: TextareaRenderable
  readonly peek: TextRenderable
  readonly choices: TextRenderable
}

const asking = (renderer: CliRenderer, id: string, placeholder = "Type to filter…"): TextareaRenderable =>
  new TextareaRenderable(renderer, {
    id,
    height: ROW_HEIGHT,
    wrapMode: "none",
    flexShrink: 0,
    marginLeft: GUTTER_X,
    marginRight: GUTTER_X,
    placeholder,
    placeholderColor: palette.faint,
    backgroundColor: palette.panel,
    focusedBackgroundColor: palette.panel,
    textColor: palette.ink,
    focusedTextColor: palette.ink,
    cursorColor: palette.ink,
  })

const makePaletteParts = (renderer: CliRenderer): PaletteParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "palette-title", palette.faint)
  const query = asking(renderer, "palette-query")
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
    const text = `${here ? marks().cursor : " "} ${row}`.padEnd(LIST_LEAD)
    return here ? bg(palette.selection)(fg(palette.ink)(`${text}\n`)) : fg(palette.ink)(`${text}\n`)
  })
  return new StyledText(drawn)
}

type SheetRow = { readonly text: string; readonly at: number; readonly heading: boolean }

const SHEET_GAP = 3

const sheetRow = (entry: Command, room: number): string => {
  const key = clip(keysOf(entry), PALETTE_KEY - PALETTE_GAP).padEnd(PALETTE_KEY)
  return `${key}${clip(entry.title, Math.max(1, room - PALETTE_KEY))}`
}

const groupedBy = (rows: ReadonlyArray<Command>): ReadonlyArray<ReadonlyArray<number>> => {
  const groups: Array<Array<number>> = []
  for (const [at, entry] of rows.entries()) {
    const last = groups.at(-1)
    const same = last !== undefined && rows[last[0] ?? 0]?.category === entry.category
    if (same && last !== undefined) last.push(at)
    else groups.push([at])
  }
  return groups
}

const sheetBlock = (
  rows: ReadonlyArray<Command>,
  group: ReadonlyArray<number>,
  room: number,
): ReadonlyArray<SheetRow> => [
  { text: rows[group[0] ?? 0]?.category ?? "", at: -1, heading: true },
  ...group.map((at) => ({
    text: sheetRow(rows[at] as Command, room),
    at,
    heading: false,
  })),
  { text: "", at: -1, heading: false },
]

const splitInTwo = (
  blocks: ReadonlyArray<ReadonlyArray<SheetRow>>,
): { readonly left: ReadonlyArray<SheetRow>; readonly right: ReadonlyArray<SheetRow> } => {
  const total = blocks.reduce((sum, block) => sum + block.length, 0)
  const left: Array<SheetRow> = []
  const right: Array<SheetRow> = []
  for (const block of blocks) {
    if (left.length + block.length <= Math.ceil(total / 2) || left.length === 0) {
      left.push(...block)
    } else right.push(...block)
  }
  return { left, right }
}

const sheetPaint = (row: SheetRow | undefined, here: boolean, room: number): TextChunk => {
  if (row === undefined) return fg(palette.ink)("".padEnd(room))
  const mark = row.heading || row.at === -1 ? " " : here ? marks().cursor : " "
  const text = `${mark} ${row.text}`.padEnd(room)
  if (row.heading) return fg(palette.accent)(text)
  return here ? bg(palette.selection)(fg(palette.ink)(text)) : fg(palette.ink)(text)
}

const sheetDeep = (rows: ReadonlyArray<Command>, room: number): number => {
  const column = Math.max(12, Math.floor((room - SHEET_GAP) / 2))
  const { left, right } = splitInTwo(
    groupedBy(rows).map((group) => sheetBlock(rows, group, column - 2)),
  )
  return Math.max(left.length, right.length)
}

const sheetText = (
  rows: ReadonlyArray<Command>,
  at: number,
  shown: { readonly height: number; readonly room: number },
): StyledText => {
  const column = Math.max(12, Math.floor((shown.room - SHEET_GAP) / 2))
  const { left, right } = splitInTwo(
    groupedBy(rows).map((group) => sheetBlock(rows, group, column - 2)),
  )
  const deep = Math.max(left.length, right.length)
  const where = left.findIndex((row) => row.at === at)
  const also = right.findIndex((row) => row.at === at)
  const on = where === -1 ? also : where
  const top = Math.max(0, Math.min(deep - shown.height, on - Math.floor(shown.height / 2)))
  const drawn: Array<TextChunk> = []
  for (let step = 0; step < Math.min(shown.height, deep); step += 1) {
    const row = top + step
    drawn.push(
      sheetPaint(left[row], left[row]?.at === at, column),
      fg(palette.ink)(" ".repeat(SHEET_GAP)),
      sheetPaint(right[row], right[row]?.at === at, column),
      fg(palette.ink)("\n"),
    )
  }
  return new StyledText(drawn)
}

const askText = (state: TuiState, room: number): StyledText => {
  const drawn = askedRows(state).map((row) => {
    const head = `${row.here ? marks().cursor : " "} ${row.title}`
    return row.here
      ? bg(palette.selection)(fg(palette.ink)(`${head.padEnd(room)}\n`))
      : fg(palette.muted)(`${head.padEnd(room)}\n`)
  })
  return new StyledText(drawn)
}

const SETTING_LEAD = 4

const settingsText = (rows: ReadonlyArray<PreferenceRow>, room: number): StyledText => {
  const drawn = rows.flatMap((row) => {
    const mark = row.on ? marks().done : " "
    const head = `${row.here ? marks().cursor : " "} ${mark} ${row.title}`
    const said = `${" ".repeat(SETTING_LEAD)}${clip(row.about, Math.max(8, room - SETTING_LEAD))}`
    const tone = row.on ? palette.added : palette.muted
    return [
      row.here
        ? bg(palette.selection)(fg(palette.ink)(`${head.padEnd(room)}\n`))
        : fg(tone)(`${head.padEnd(room)}\n`),
      fg(palette.faint)(`${said.padEnd(room)}\n`),
    ]
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
  settings: makeSettingsParts(renderer),
  reader: makeReaderParts(renderer),
  bases: makeBaseParts(renderer),
  ask: makeAskParts(renderer),
})

type BaseParts = {
  readonly box: BoxRenderable
  readonly title: TextRenderable
  readonly query: TextareaRenderable
  readonly choices: TextRenderable
}

const makeBaseParts = (renderer: CliRenderer): BaseParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "base-title", palette.faint)
  const query = asking(renderer, "base-query", "Type a branch, a tag or a commit…")
  const choices = makeChoices(renderer)
  box.id = "base"
  box.add(title)
  box.add(query)
  box.add(choices)
  return { box, title, query, choices }
}

const makeAskParts = (renderer: CliRenderer) => {
  const box = makePalette(renderer)
  const title = bar(renderer, "ask-title", palette.faint)
  const choices = makeChoices(renderer)
  box.id = "ask"
  box.add(title)
  box.add(choices)
  return { box, title, choices }
}

const makeReaderParts = (renderer: CliRenderer) => {
  const box = makePalette(renderer)
  const title = bar(renderer, "reader-title", palette.faint)
  const choices = makeChoices(renderer)
  box.id = "reader"
  box.add(title)
  box.add(choices)
  return { box, title, choices }
}

const makeSettingsParts = (renderer: CliRenderer) => {
  const box = makePalette(renderer)
  const title = bar(renderer, "settings-title", palette.faint)
  const choices = makeChoices(renderer)
  box.id = "settings"
  box.add(title)
  box.add(choices)
  return { box, title, choices }
}

const makeKeysParts = (renderer: CliRenderer): KeysParts => {
  const parts = makePaletteParts(renderer)
  parts.box.id = "keys"
  const legend = bar(renderer, "keys-legend", palette.faint)
  parts.box.add(legend)
  return { ...parts, legend }
}

const makeFoundParts = (renderer: CliRenderer): FoundParts => {
  const box = makePalette(renderer)
  const title = bar(renderer, "found-title", palette.faint)
  const query = asking(renderer, "found-query", "Type what to look for…")
  const peek = bar(renderer, "found-peek", palette.muted)
  const choices = makeChoices(renderer)
  box.id = "found"
  box.add(title)
  box.add(query)
  box.add(choices)
  box.add(peek)
  return { box, title, query, peek, choices }
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

const MAC_KEYS: ReadonlyArray<KeyBinding> = [
  { name: "left", super: true, action: "line-home" },
  { name: "right", super: true, action: "line-end" },
  { name: "left", super: true, shift: true, action: "select-line-home" },
  { name: "right", super: true, shift: true, action: "select-line-end" },
  { name: "up", super: true, action: "buffer-home" },
  { name: "down", super: true, action: "buffer-end" },
  { name: "backspace", super: true, action: "delete-to-line-start" },
  { name: "backspace", meta: true, action: "delete-word-backward" },
  { name: "return", shift: true, action: "newline" },
  { name: "return", meta: true, action: "newline" },
]

const makeComposeParts = (
  renderer: CliRenderer,
): {
  readonly title: TextRenderable
  readonly quoted: TextRenderable
  readonly body: TextareaRenderable
  readonly actions: TextRenderable
} => ({
  title: new TextRenderable(renderer, {
    id: "compose-title",
    content: "",
    fg: palette.ink,
    wrapMode: "none",
  }),
  quoted: new TextRenderable(renderer, {
    id: "compose-quoted",
    content: "",
    fg: palette.muted,
    wrapMode: "none",
  }),
  body: new TextareaRenderable(renderer, {
    id: "compose-body",
    wrapMode: "word",
    keyBindings: [...defaultTextareaKeyBindings, ...MAC_KEYS],
    backgroundColor: palette.panel,
    focusedBackgroundColor: palette.panel,
    textColor: palette.ink,
    focusedTextColor: palette.ink,
    cursorColor: palette.ink,
    placeholder: "",
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

const stillThere = (sent: TuiState["sent"]): TuiState["sent"] =>
  sent.filter((one) => one.removed !== true)

const quotedFor = (state: TuiState, shownLines: number, room: number): ReadonlyArray<string> => {
  const answering = remarkQuote(state, room)
  if (answering.length > 0) {
    return answering.slice(0, shownLines * 2).map((line) => clip(line, room))
  }
  const said = threadQuote(state, room)
  if (said.length > 0) return said.slice(0, shownLines * 2).map((line) => clip(line, room))
  if (state.replyTo !== undefined) return []
  const snippet = snippetOf(state, shownLines)
  const more = selectedLineCount(state) - snippet.length
  const tail = more > 0 ? [`     … ${more} more lines`] : []
  return [...snippet, ...tail].map((line) => clip(line, room))
}

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

const waitingLabel = (branch: TuiState["branches"][number]): string =>
  branch.unanswered > 0 ? `${branch.unanswered} unanswered` : ""

const inRange = (state: TuiState, row: number, from: number, to: number): boolean =>
  state.selecting && row >= from && row <= to

const notesOf = (
  comments: ReadonlyArray<StagedComment>,
  path: string,
  sent: boolean,
  shown: { readonly opened: ReadonlyArray<string>; readonly now: number } = {
    opened: [],
    now: Date.now(),
  },
): ReadonlyArray<Note> =>
  comments
    .filter((entry) => entry.file === path && entry.outside !== true)
    .toSorted((left, right) => (left.at ?? "").localeCompare(right.at ?? ""))
    .map((entry) => ({
      id: entry.id ?? "",
      folded: entry.settled === true && !(entry.id !== undefined && shown.opened.includes(entry.id)),
      side: entry.side,
      line: entry.end,
      body: entry.body,
      sent,
      settled: entry.settled === true,
      stale: entry.stale === true,
      asks: entry.asks === true,
      answers: entry.answers ?? [],
      turns: entry.turns ?? [],
      takenAt: entry.takenAt,
      now: shown.now,
    }))

const remarksOf = (state: TuiState, path: string): ReadonlyArray<Note> =>
  state.remarks
    .filter((one) => one.file === path && remarkShown(one))
    .map((one) => ({
      id: one.id,
      from: one.by,
      folded: false,
      side: one.side,
      line: one.end,
      body: one.body,
      sent: false,
      settled: false,
      stale: one.outdated,
      asks: false,
      answers: [],
      turns: one.replies.map((said) => ({
        voice: "reviewer" as const,
        by: said.by,
        body: said.body,
      })),
      takenAt: undefined,
      now: state.now,
    }))

const notesFor = (state: TuiState, path: string): ReadonlyArray<Note> => [
  ...notesOf(stillThere(state.sent), path, true, { opened: state.opened, now: state.now }),
  ...remarksOf(state, path),
]

const paired = (chunks: ReadonlyArray<TextChunk>): ReadonlyArray<ReadonlyArray<TextChunk>> => {
  const chips: Array<ReadonlyArray<TextChunk>> = []
  for (let at = 0; at < chunks.length; at += CHIP_CHUNKS) {
    chips.push(chunks.slice(at, at + CHIP_CHUNKS))
  }
  return chips
}

const chipWidth = (chip: ReadonlyArray<TextChunk>): number =>
  chip.reduce((total, chunk) => total + chunk.text.length, 0)

const WAYS_OUT = 2

const keptWithin = (chunks: ReadonlyArray<TextChunk>, room: number): ReadonlyArray<TextChunk> => {
  const chips = paired(chunks)
  if (chips.length <= WAYS_OUT) return chips.flat()
  const ways = chips.slice(-WAYS_OUT)
  const kept: Array<ReadonlyArray<TextChunk>> = []
  let used = ways.reduce((total, chip) => total + chipWidth(chip), 0)
  for (const chip of chips.slice(0, -WAYS_OUT)) {
    const width = chipWidth(chip)
    if (used + width > room) break
    kept.push(chip)
    used += width
  }
  return [...kept, ...ways].flat()
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

const SUMMARY_LINES = 5

const summaryLines = (
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

const nameRoom = (pane: number, longest = pane): number =>
  Math.max(BRANCH_NAME_MIN, Math.min(longest, pane - BRANCH_FIXED - STATE_MIN))

const stateRoom = (pane: number, name: number): number => Math.max(0, pane - name - BRANCH_FIXED)

const columns = (cells: Cells, room: number): string =>
  `${clip(cells.name, room).padEnd(room)}${cells.files.padStart(5)}${cells.added.padStart(8)}${cells.gone.padStart(8)}  ${cells.layers.padStart(8)}   ${cells.state}`

const FORGE_SILENT = "  could not reach the forge, so no pull request is shown"

const unaskedForge = (state: TuiState): ReadonlyArray<TextChunk> =>
  state.forge === "silent" ? [fg(palette.attention)(`\n${FORGE_SILENT}`)] : []

const branchHeading = (room: number): string =>
  `  ${columns(
    { name: "BRANCH", files: "FILES", added: "+", gone: "-", layers: "LAYERS", state: "STATE" },
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

const placeLabel = (state: TuiState): string => {
  const place = filePlace(state)
  return `file ${place.at} of ${place.of}`
}

const headerParts = (
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
  const seen = row.fileIndex !== undefined && isReviewed(state, row.fileIndex) ? marks().done : " "
  const here = row.fileIndex !== undefined && row.fileIndex === state.patchIndex
  return `${here ? marks().cursor : " "}${seen}`
}

const treeTail = (state: TuiState, row: TreeRow): string => {
  if (row.fileIndex === undefined) return "  "
  const threads = threadsOn(state, row.fileIndex)
  return threads.open > 0 ? `${threads.open}${standMark(threads.stand)}`.padStart(3) : "   "
}

const treeLine = (state: TuiState, row: TreeRow, pane: number): string => {
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

const staleBanner = (room: number): string =>
  wrapped(staleSaid(room), room)
    .map((line) => ` ${line}`)
    .join("\n")

type Screened = TuiState["screen"]

const ASKING: ReadonlyArray<Screened> = ["palette", "keys", "search", "base", "editor"]

type LayerLook = {
  readonly lead: number
  readonly mark: string
  readonly paint: string
}

const litRow = (row: LayerRow, state: TuiState, drawn: TextChunk): TextChunk =>
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

const layerLook = (state: TuiState, row: LayerRow): LayerLook => {
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

const layerText = (row: LayerRow, look: LayerLook, room: LayerRoom): string =>
  row.kind === "gap"
    ? ""
    : `${layerGutter(row, look)}${" ".repeat(look.lead - GUTTER)}${row.text}`.padEnd(
        room.title + TITLE_LEAD,
      )

const standingOnRemark = (state: TuiState): boolean => remarkToTakeOn(state) !== undefined

const standingOnDismissed = (state: TuiState): boolean =>
  remarkUnderCursor(state)?.dismissed === true

const offeredIn = (state: TuiState): Offered => ({
  comments: state.sent.length,
  held: state.held.length,
  layers: state.layers.length,
  onThread: standingOnThread(state),
  onRemark: standingOnRemark(state),
  onDismissed: standingOnDismissed(state),
  selecting: state.selecting,
  reviewed: reviewedCountIn(state),
  pull: pullHere(state).length > 0,
  pane: state.screen === "review" ? state.focus : "diff",
  stale: state.layersStale,
  onLayers: onLayers(state),
  hidingRead: state.hideReviewed,
  hidingSettled: state.hideSettled,
  onRemoved: threadHere(state)?.removed === true,
  onSettled: threadHere(state)?.settled === true,
  onHeld: state.focus === "review" && panelEntry(state)?.section === "held",
})

const readerTitle = (state: TuiState, entry: PanelEntry): string => {
  if (entry.kind === "fold") return "The branch moved past these"
  const where = wherePart(state, entry).replace(" · ", "").trim()
  return where.length === 0 ? "This thread" : `This thread · ${where}`
}

const voicesOf = (entry: PanelEntry): ReadonlyArray<string> => {
  if (entry.kind === "fold") return []
  if (entry.kind === "remark") {
    return [
      `@${entry.remark.by} ${entry.remark.body}`,
      ...entry.remark.replies.map((reply) => `@${reply.by} ${reply.body}`),
    ]
  }
  const turns = entry.comment.turns
  if (turns === undefined || turns.length === 0) return [entry.comment.body]
  return turns.map((turn) => `${turn.voice === "agent" ? "↳" : "»"} ${turn.body}`)
}

const readerText = (entry: PanelEntry, room: number): StyledText => {
  const named = entry.kind === "fold" ? [] : [...wrapped(panelFile(entry), room), ""]
  const said = voicesOf(entry).flatMap((line) => wrapped(line, room))
  const code = lostCode(entry)
  const quoted =
    code.length === 0
      ? []
      : ["", "the code it was written on", ...code.map((line) => `│ ${line.trim()}`)]
  const rows = [...named, ...said, ...quoted].flatMap((line) => wrapped(line, room))
  return new StyledText(
    rows.map((line) => fg(line.startsWith("│") ? palette.faint : palette.ink)(`${line.padEnd(room)}\n`)),
  )
}

const PANEL_TITLES: Readonly<Record<PanelSection, string>> = {
  remarks: "Remarks",
  dismissed: "Dismissed",
  held: "Waiting to be sent",
  asked: "Waiting on you",
  filed: "Not picked up",
  with: "Picked up, no answer",
  answered: "Answered, not settled",
  movedOn: "The branch moved past these",
  settled: "Settled",
  removed: "Removed",
}

const PANEL_ORDER = PANEL_SECTIONS
const PANEL_LEAD = 3
const PANEL_EMPTY = "No comment on this branch yet."

type PanelLine = {
  readonly text: string
  readonly tone: string
  readonly here?: boolean
  readonly at?: number
}

const restingOrHere = (focused: boolean): string =>
  focused ? palette.selection : palette.resting

const FOUND_LEAST = 6

const nothingYet = (state: TuiState, room: number): string => {
  const wanted = state.query.trim()
  if (wanted.length === 0 || state.term.length === 0) return "".padEnd(room)
  return clip(` nothing uses ${wanted}`, room).padEnd(room)
}

const counting = (many: number): string => many.toLocaleString("en-US")

const foundBlocks = (
  state: TuiState,
  shown: ReadonlyArray<Match>,
  wide: number,
): { readonly blocks: ReadonlyArray<Block>; readonly chosen: number } => {
  const blocks: Array<Block> = []
  let chosen = 0
  for (const [at, match] of shown.entries()) {
    if (shown[at - 1]?.path !== match.path) {
      blocks.push(fileRow(match, wide, shown.some((one) => one.path === match.path && one.declares)))
    }
    if (at === state.matchIndex) chosen = blocks.length
    blocks.push(blockOf(match, wide, at === state.matchIndex, state.around))
  }
  if (state.leftOut > 0 && shown.length > 0) blocks.push(leftRow(state.leftOut, wide))
  return { blocks, chosen }
}

const JOIN = "  ·  "

const foundTitle = (state: TuiState, room: number): string => {
  if (state.term.length === 0) return "Look for something"
  const counted = state.counted
  if (counted.worktree === 0) return state.term
  const here = `${counting(counted.file)} in this file`
  const branch = `${counting(counted.branch)} on this branch`
  const whole = `${counting(counted.worktree)} in the worktree`
  const tried = [
    [state.term, here, branch, whole],
    [state.term, here, whole],
    [state.term, whole],
    [state.term],
  ].map((parts) => parts.join(JOIN))
  return tried.find((one) => one.length <= room) ?? clip(tried.at(-1) ?? "", room)
}

type Block = { readonly rows: number; readonly chunks: ReadonlyArray<TextChunk> }

type Found = {
  readonly changed: boolean
  readonly declares: boolean
  readonly path: string
  readonly line: number
  readonly text: string
}

const CHANGED_MARK = "*"

const DECLARED = "declared"

const fileRow = (match: Found, room: number, declares: boolean): Block => {
  const lead = match.changed ? CHANGED_MARK : " "
  const tail = declares ? `  ${DECLARED}` : ""
  const shown = ` ${lead} ${clipHead(match.path, Math.max(8, room - 3 - tail.length))}${tail}`
  return {
    rows: 1,
    chunks: [fg(palette.accent)(shown.padEnd(room)), fg(palette.faint)("\n")],
  }
}

const leftRow = (left: number, room: number): Block => ({
  rows: 1,
  chunks: [
    fg(palette.faint)(clip(`   … ${counting(left)} more places not shown`, room).padEnd(room)),
    fg(palette.faint)("\n"),
  ],
})

const placeRow = (match: Found, room: number): TextChunk => {
  const tail = match.declares ? `  ${DECLARED}` : ""
  const text = clip(match.text.trim(), Math.max(1, room - 11 - tail.length))
  const line = `   ${String(match.line).padStart(5)}  ${text}${tail}`
  return fg(match.declares ? palette.ink : palette.muted)(line.padEnd(room))
}

const blockOf = (
  match: Found,
  room: number,
  here: boolean,
  around: ReadonlyArray<string>,
): Block => {
  const rows = here && around.length > 0
    ? around.map((line) => aroundRow(line, match.line, room))
    : [placeRow(match, room)]
  const lit = rows.map((chunk) => (here ? bg(palette.selection)(chunk) : chunk))
  return {
    rows: lit.length,
    chunks: lit.flatMap((chunk) => [chunk, fg(palette.faint)("\n")]),
  }
}

const aroundRow = (line: string, at: number, room: number): TextChunk => {
  const numbered = /^\s*(\d+) ?(.*)$/.exec(line)
  const number = Number(numbered?.[1] ?? 0)
  const text = numbered?.[2] ?? line
  const mark = number === at ? marks().cursor : " "
  const said = `  ${mark} ${String(number).padStart(5)}  ${text}`
  return fg(number === at ? palette.ink : palette.faint)(clip(said, room).padEnd(room))
}

const windowedBlocks = (
  blocks: ReadonlyArray<Block>,
  at: number,
  room: number,
): { readonly rows: number; readonly chunks: ReadonlyArray<TextChunk> } => {
  const kept: Array<Block> = []
  let rows = 0
  for (const [index, block] of blocks.entries()) {
    if (index < at && rows + block.rows > room) continue
    if (rows + block.rows > room && index > at) break
    kept.push(block)
    rows += block.rows
  }
  return { rows, chunks: kept.flatMap((block) => block.chunks) }
}

const pickingTitle = (state: TuiState): string => {
  if (state.screen === "editor") {
    return `Editor${state.editorNow.length === 0 ? " — none found" : ` — now ${state.editorNow}`}`
  }
  const here = selectedBranch(state)
  const on = here === undefined ? "" : `${here.base}${here.basis === "set" ? "" : ", adiff's guess"}`
  return `Base for ${here?.branch ?? "this branch"}${on.length === 0 ? "" : ` — now ${on}`}`
}

const YOURS = "   ← the command you typed"

const YOUR_REF = "   ← the ref you typed"

const pickedTail = (state: TuiState, ref: string, typed: string): string => {
  if (typed.length === 0 || ref !== typed || state.refs.includes(ref)) return ""
  return state.screen === "editor" ? YOURS : YOUR_REF
}

const REMARK_MARK = "◇"

const remarkWhere = (remark: Remark, known: boolean): string => {
  if (remark.placed) return `:${remark.end}`
  if (remark.outdated) return " · outdated"
  return known ? " · outside this diff" : " · not in the diff"
}

const wherePart = (state: TuiState, entry: PanelEntry): string => {
  if (entry.kind === "fold") return ""
  if (entry.kind === "remark") {
    const known = state.patches.some((patch) => patch.path === entry.remark.file)
    return remarkWhere(entry.remark, known)
  }
  return entry.comment.outside === true ? " · not in the diff" : `:${entry.comment.end}`
}

const panelFile = (entry: PanelEntry): string => {
  if (entry.kind === "fold") return ""
  return entry.kind === "remark" ? entry.remark.file : entry.comment.file
}

const panelWhere = (state: TuiState, entry: PanelEntry, room: number): string => {
  const where = wherePart(state, entry)
  return `${clipPath(panelFile(entry), Math.max(4, room - where.length))}${where}`
}

const panelBody = (entry: PanelEntry): string => {
  if (entry.kind === "fold") return ""
  const said = entry.kind === "remark" ? `@${entry.remark.by} ${entry.remark.body}` : entry.comment.body
  return said.split("\n").find((line) => line.trim().length > 0) ?? ""
}

const panelMark = (entry: PanelEntry): string => {
  if (entry.kind === "fold") return entry.open ? marks().open : marks().shut
  return entry.kind === "remark" ? REMARK_MARK : standMark(threadStand(entry.comment))
}

type Placed = { readonly entry: PanelEntry; readonly at: number }

const WRITTEN_ON = 4

const lostCode = (entry: PanelEntry): ReadonlyArray<string> => {
  if (entry.kind === "fold") return []
  const said = entry.kind === "remark" ? entry.remark.code : (entry.comment.snippet ?? "").split("\n")
  return said.filter((line) => line.trim().length > 0)
}

const lostEntry = (state: TuiState, entry: PanelEntry): boolean =>
  entry.kind === "fold"
    ? false
    : entry.kind === "remark"
    ? !entry.remark.placed && state.patches.some((patch) => patch.path === entry.remark.file)
    : entry.comment.outside === true

const writtenOn = (
  state: TuiState,
  placed: Placed,
  room: number,
): ReadonlyArray<PanelLine> => {
  const { entry } = placed
  if (placed.at !== state.panelIndex || !lostEntry(state, entry)) return []
  const code = lostCode(entry)
  if (code.length === 0) return []
  const shown = code.slice(-WRITTEN_ON)
  const cut = code.length - shown.length
  const rows = shown.map((line) => ({
    text: clip(`   │ ${line.trim()}`, room),
    tone: palette.faint,
  }))
  const more = cut === 0 ? [] : [{ text: clip(`   │ ⋯ ${cut} more`, room), tone: palette.faint }]
  return [
    { text: clip("   the code it was written on", room), tone: palette.faint },
    ...more,
    ...rows,
  ]
}

const foldLine = (state: TuiState, placed: Placed, room: number): ReadonlyArray<PanelLine> => {
  const { entry } = placed
  if (entry.kind !== "fold") return []
  const here = placed.at === state.panelIndex
  const said = entry.open ? "h folds them away" : "l opens them"
  const text = ` ${panelMark(entry)} ${entry.held} ${entry.held === 1 ? "comment" : "comments"} · ${said}`
  return [{ text: clip(text, room), tone: palette.faint, here, at: placed.at }]
}

const panelPair = (state: TuiState, placed: Placed, room: number): ReadonlyArray<PanelLine> => {
  const { entry } = placed
  if (entry.kind === "fold") return foldLine(state, placed, room)
  const lead = ` ${panelMark(entry)} `
  const here = placed.at === state.panelIndex
  return [
    {
      text: `${lead}${panelWhere(state, entry, room - PANEL_LEAD)}`,
      tone: palette.ink,
      here,
      at: placed.at,
    },
    {
      text: `   ${clip(panelBody(entry), Math.max(4, room - PANEL_LEAD))}`,
      tone: palette.muted,
      here,
      at: placed.at,
    },
    ...writtenOn(state, placed, room),
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
  const counted = panelHolds(state).filter((entry) => entry.section === section).length
  return [
    { text: "", tone: palette.faint },
    { text: `${PANEL_TITLES[section]}  ${counted}`, tone: palette.faint },
    ...here.flatMap((one) => panelPair(state, one, room)),
  ]
}

const PULL_HINT = "answered, press r to pull"

const panelWindow = (
  lines: ReadonlyArray<PanelLine>,
  rows: number,
): { readonly lines: ReadonlyArray<PanelLine>; readonly above: number; readonly below: number } => {
  if (lines.length <= rows) return { lines, above: 0, below: 0 }
  const room = Math.max(1, rows - 2)
  const at = Math.max(0, lines.findIndex((line) => line.here === true))
  const start = Math.max(0, Math.min(lines.length - room, at - Math.floor(room / 2)))
  return {
    lines: lines.slice(start, start + room),
    above: start,
    below: lines.length - (start + room),
  }
}

const moreLine = (count: number, mark: string, room: number): ReadonlyArray<PanelLine> =>
  count === 0 ? [] : [{ text: clip(` ${mark} ${count} more`, room), tone: palette.faint }]

const panelPicked = (
  banner: number,
  above: number,
  lines: ReadonlyArray<PanelLine>,
): ReadonlyArray<Clicked> => [
  ...Array.from({ length: banner + (above > 0 ? 1 : 0) }, () => ({ pane: "review" as const })),
  ...lines.map((line) => ({ pane: "review" as const, entry: line.at })),
]

const panelText = (
  state: TuiState,
  room: number,
  rows: number,
  picked?: (found: ReadonlyArray<Clicked>) => void,
): StyledText => {
  const placed = panelEntries(state).map((entry, at): Placed => ({ entry, at }))
  const holds = panelHolds(state)
  const fresh = holds.filter((entry) => entry.kind === "comment" && entry.fresh).length
  const unread = holds.filter((entry) => entry.kind === "comment" && entry.unread > 0).length
  const said = fresh > 0 ? `${fresh} ${PULL_HINT}` : unread > 0 ? `${unread} unread` : ""
  const banner: ReadonlyArray<PanelLine> =
    said.length === 0 ? [] : [{ text: clip(said, room), tone: palette.attention }]
  const sections = PANEL_ORDER.flatMap((section) => panelSection(state, placed, section, room))
  const body = sections.slice(sections[0]?.text === "" ? 1 : 0)
  const lines = body.length === 0 ? [{ text: PANEL_EMPTY, tone: palette.muted }] : body
  const window = panelWindow(lines, Math.max(1, rows - banner.length))
  const shown = [
    ...banner,
    ...moreLine(window.above, "▲", room),
    ...window.lines,
    ...moreLine(window.below, "▼", room),
  ]
  picked?.(panelPicked(banner.length, window.above, shown.slice(banner.length)))
  return new StyledText(
    shown.map((line) => {
      const drawn = fg(line.tone)(`${line.text.padEnd(room)}\n`)
      return line.here === true ? bg(restingOrHere(state.focus === "review"))(drawn) : drawn
    }),
  )
}

export type Mouse = {
  readonly onClick: (what: Clicked) => void
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
  private chrome = 0
  private shown: TuiState | undefined
  private chips: ReadonlyArray<{ key: string; hint: string; press: string }> = []
  private readonly composeTitle: TextRenderable
  private readonly composeQuoted: TextRenderable
  private readonly composeBody: TextareaRenderable
  private readonly composeActions: TextRenderable
  private readonly footer: TextRenderable
  private readonly cramped: TextRenderable
  private readonly palette: BoxRenderable
  private readonly paletteTitle: TextRenderable
  private readonly paletteQuery: TextareaRenderable
  private readonly paletteChoices: TextRenderable
  private readonly keys: BoxRenderable
  private readonly keysTitle: TextRenderable
  private readonly baseBox: BaseParts
  private readonly settings: BoxRenderable
  private readonly settingsTitle: TextRenderable
  private readonly settingsChoices: TextRenderable
  private readonly keysQuery: TextareaRenderable
  private readonly keysChoices: TextRenderable
  private readonly keysLegend: TextRenderable
  private readonly ask: {
    readonly box: BoxRenderable
    readonly title: TextRenderable
    readonly choices: TextRenderable
  }
  private readonly reader: {
    readonly box: BoxRenderable
    readonly title: TextRenderable
    readonly choices: TextRenderable
  }
  private readonly foundBox: FoundParts

  private readonly renderer: CliRenderer

  private mouse: Mouse | undefined
  private listPicks: ReadonlyArray<Clicked> = []
  private panelPicks: ReadonlyArray<Clicked> = []
  private dragFrom: Spot | undefined
  private lastTop = 0
  private drafted: Draft | undefined
  private drafting: number | undefined

  constructor(renderer: CliRenderer, repo = "") {
    this.renderer = renderer
    this.repo = repo
    frameRoot(renderer)
    this.header = bar(renderer, "header", palette.ink)
    this.footer = bar(renderer, "footer", palette.faint)
    this.cramped = crampedBar(renderer)
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
    this.composeQuoted = inside.quoted
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
    this.settings = modals.settings.box
    this.settingsTitle = modals.settings.title
    this.settingsChoices = modals.settings.choices
    this.keysTitle = modals.keys.title
    this.keysQuery = modals.keys.query
    this.keysChoices = modals.keys.choices
    this.keysLegend = modals.keys.legend
    this.baseBox = modals.bases
    this.reader = modals.reader
    this.ask = modals.ask
    this.foundBox = modals.found
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

  private clickIn(
    box: TextRenderable,
    picks: () => ReadonlyArray<Clicked>,
    pane: "tree" | "review",
  ): (event: { y: number }) => void {
    return (event) => {
      const found = picks()[Math.max(0, event.y - box.y)]
      this.mouse?.onClick(found ?? { pane })
    }
  }

  listen(mouse: Mouse): void {
    this.mouse = mouse
    this.list.onMouseDown = this.clickIn(this.list, () => this.listPicks, "tree")
    this.panel.onMouseDown = this.clickIn(this.panel, () => this.panelPicks, "review")
    this.wheelOnSheet(this.keys)
    this.wheelOnSheet(this.palette)
    this.wheelOnRail(this.listPane)
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

  private asking(screen: Screened): TextareaRenderable | undefined {
    switch (screen) {
      case "palette":
        return this.paletteQuery
      case "search":
        return this.foundBox.query
      case "keys":
        return this.keysQuery
      case "base":
      case "editor":
        return this.baseBox.query
      default:
        return undefined
    }
  }

  private askBoxes(): ReadonlyArray<TextareaRenderable> {
    return ASKING.flatMap((name) => {
      const box = this.asking(name)
      return box === undefined ? [] : [box]
    })
  }

  written(): string {
    return this.composeBody.plainText
  }

  write(text: string): void {
    this.composeBody.setText(text)
  }

  writeOn(on: boolean): void {
    if (on) this.composeBody.focus()
    else this.composeBody.blur()
  }

  onWritten(told: (text: string) => void): void {
    this.composeBody.onContentChange = () => told(this.composeBody.plainText)
  }

  askOn(which: Screened | undefined): void {
    const wanted = which === undefined ? undefined : this.asking(which)
    for (const box of this.askBoxes()) {
      if (box !== wanted) box.blur()
    }
    if (wanted === undefined) return
    wanted.setText("")
    wanted.focus()
  }

  askWith(text: string): void {
    for (const box of this.askBoxes()) box.setText(text)
  }

  onAsked(told: (text: string) => void): void {
    for (const box of this.askBoxes()) box.onContentChange = () => told(box.plainText)
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
    this.chips = hintsFor(state.screen, offeredIn(state))
    this.header.content = this.headerText(state)
    this.footer.content = this.footerText(state)
    this.list.content = this.listText(state)
    const many = state.branches.length === 1 ? "1 branch" : `${state.branches.length} branches`
    const pane = this.homeRoom(state)
    const room = Math.max(HOME_PATH_MIN, pane - many.length - HOME_PATH_CHROME)
    this.landing.content = `${elide(shortPath(this.repo), room)}  ·  ${many}`
    this.landingKeys.visible = false
    this.diffPane.visible = state.screen !== "branches" && !atHome(state)
    this.paintPanel(state)
    this.paintPane(state)
    if (this.diffPane.visible) this.paintDiff(state)
    this.paintCompose(state)
    this.paintPalette(state)
    this.paintKeys(state)
    this.paintSettings(state)
    this.paintBases(state)
    this.paintReader(state)
    this.paintAsk(state)
    this.paintFound(state)
    this.paintReport(state)
    this.scrim.visible = state.screen !== "branches" && state.screen !== "review"
    this.paintCramped()
  }

  private paintCramped(): void {
    const cramped = tooSmall(this.renderer.width, this.renderer.height)
    this.cramped.visible = cramped
    this.body.visible = !cramped
    this.header.visible = !cramped
    this.footer.visible = !cramped
    if (cramped) this.cramped.content = wrapped(CRAMPED, this.renderer.width - 1).join("\n")
  }

  private paintPalette(state: TuiState): void {
    this.palette.visible = state.screen === "palette"
    if (state.screen !== "palette") {
      this.paletteTitle.content = ""
      this.paletteChoices.content = ""
      return
    }
    const matches = paletteMatches(state)
    this.paletteTitle.content = matches.length === 0 ? "No command matches" : "Commands"
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

  private paintBases(state: TuiState): void {
    this.baseBox.box.visible = picking(state)
    if (!picking(state)) {
      this.baseBox.title.content = ""
      this.baseBox.choices.content = ""
      return
    }
    const shown = refsShown(state)
    const room = panelWidth(this.renderer.width)
    this.baseBox.title.content = clip(pickingTitle(state), room - MODAL_ROOM)
    this.baseBox.query.visible = true
    const tall = Math.min(
      panelRows(this.renderer.height, PANEL_QUARTER),
      shown.length + PALETTE_CHROME + 1,
    )
    const typed = state.query.trim()
    this.baseBox.choices.content = listText(
      shown.map((ref) =>
        clip(
          ` ${ref}${refSaidOf(state, ref).length === 0 ? "" : `  ${refSaidOf(state, ref)}`}${pickedTail(state, ref, typed)}`,
          room - MODAL_ROOM,
        ),
      ),
      Math.min(state.refIndex, Math.max(0, shown.length - 1)),
      Math.max(1, tall - PALETTE_CHROME - 1),
    )
    this.baseBox.box.height = tall
    this.baseBox.box.width = room
    this.baseBox.box.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.baseBox.box.top = panelTop(this.renderer.height, PANEL_QUARTER)
  }

  private paintSettings(state: TuiState): void {
    this.settings.visible = state.screen === "settings"
    if (state.screen !== "settings") {
      this.settingsTitle.content = ""
      this.settingsChoices.content = ""
      return
    }
    const rows = preferenceRows(state)
    const room = panelWidth(this.renderer.width)
    const tall = Math.min(
      panelRows(this.renderer.height, PANEL_QUARTER),
      rows.length * 2 + PALETTE_CHROME - 1,
    )
    this.settingsTitle.content = "What adiff does"
    this.settingsChoices.content = settingsText(rows, room - MODAL_ROOM)
    this.settings.height = tall
    this.settings.width = room
    this.settings.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.settings.top = panelTop(this.renderer.height, PANEL_QUARTER)
  }

  private paintAsk(state: TuiState): void {
    this.ask.box.visible = state.screen === "settling"
    if (state.screen !== "settling") {
      this.ask.title.content = ""
      this.ask.choices.content = ""
      return
    }
    const room = panelWidth(this.renderer.width)
    const asked = asksAbout(state)
    const forName = Math.max(8, room - MODAL_ROOM - asked.tail.length)
    const name = asked.path ? clipPath(asked.name, forName) : clipMiddle(asked.name, forName)
    this.ask.title.content = `${name}${asked.tail}`
    this.ask.choices.content = askText(state, room - MODAL_ROOM)
    this.ask.box.height = askedRows(state).length + PALETTE_CHROME
    this.ask.box.width = room
    this.ask.box.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.ask.box.top = panelTop(this.renderer.height, PANEL_QUARTER)
  }

  private paintReader(state: TuiState): void {
    const entry = panelEntry(state)
    this.reader.box.visible = state.screen === "thread" && entry !== undefined
    if (state.screen !== "thread" || entry === undefined) {
      this.reader.title.content = ""
      this.reader.choices.content = ""
      return
    }
    const room = panelWidth(this.renderer.width)
    this.reader.title.content = clip(readerTitle(state, entry), room - MODAL_ROOM)
    this.reader.choices.content = readerText(entry, room - MODAL_ROOM)
    this.reader.box.height = Math.min(
      panelRows(this.renderer.height, PANEL_QUARTER),
      voicesOf(entry).length + lostCode(entry).length + PALETTE_CHROME + 8,
    )
    this.reader.box.width = room
    this.reader.box.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.reader.box.top = panelTop(this.renderer.height, PANEL_QUARTER)
  }

  private paintKeys(state: TuiState): void {
    this.keys.visible = state.screen === "keys"
    if (state.screen !== "keys") {
      this.keysTitle.content = ""
      this.keysChoices.content = ""
      this.keysLegend.content = ""
      return
    }
    const rows = keyMatches(state)
    const room = this.renderer.width
    const keysRoom = this.renderer.height
    const shown = Math.max(1, keysRoom - PENDING_CHROME - LEGEND_ROWS)
    this.keysTitle.content = keysTitle(rows.length, sheetDeep(rows, room - MODAL_ROOM) <= shown)
    this.keysChoices.content = sheetText(
      rows,
      Math.min(state.paletteIndex, Math.max(0, rows.length - 1)),
      { height: shown, room: room - MODAL_ROOM },
    )
    this.keysLegend.content = legendText(room - MODAL_ROOM)
    this.keys.height = keysRoom
    this.keys.width = room
    this.keys.left = 0
    this.keys.top = 0
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
      { pan: Math.min(state.pan, this.view.panLimit()), cutOff: this.view.cutOff() },
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

  private railsRoom(): number {
    return (
      (this.listPane.visible ? this.listPane.width : 0) +
      (this.panelPane.visible ? this.panelPane.width : 0)
    )
  }

  private diffRoom(): number {
    const measured = this.view.paneWidth()
    const settled = this.renderer.width - this.railsRoom() - measured
    if (settled >= 0 && settled < DIFF_CHROME_MOST) this.chrome = settled
    return Math.max(DIFF_FLOOR, this.renderer.width - this.railsRoom() - this.chrome)
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
    const rows = Math.max(1, this.panelPane.height - PANE_EDGES)
    this.panel.content = shown
      ? panelText(state, reviewWidth() - PANE_CHROME, rows, (found) => (this.panelPicks = found))
      : ""
  }

  private listText(state: TuiState): string | StyledText {
    if (atHome(state)) return this.branchTable(state)
    if (onLayers(state)) return this.layerRail(state)
    const room = this.listRoom()
    const pane = this.paneRoom()
    const whole = treeWindow(state, room)
    const window = whole.more === 0 ? whole : treeWindow(state, Math.max(1, room - 1))
    this.listPicks = window.rows.map((row) => ({ pane: "tree" as const, file: row.fileIndex }))
    const rows = window.rows.flatMap((row) => {
      const drawn = fg(row.kind === "file" ? palette.ink : palette.muted)(
        `${treeLine(state, row, pane)}\n`,
      )
      return [row.fileIndex === state.patchIndex ? bg(restingOrHere(state.focus === "tree"))(drawn) : drawn]
    })
    const more = window.more > 0 ? [fg(palette.faint)(` … ${window.more} more`)] : []
    return new StyledText([...rows, ...more])
  }

  private listRoom(): number {
    const edges = this.listPane.border === true ? PANE_EDGES : PANE_INSET
    return Math.max(1, this.listPane.height - edges)
  }

  private layerRail(state: TuiState): StyledText {
    const room = layerRoomIn(state)
    const said = summaryLines(state.summary, room.title, this.listRoom())
    const banner = (state.layersStale ? 1 : 0) + said.length
    const height = Math.max(1, this.listRoom() - banner)
    const all = layerFitted(state, room, height)
    const window = this.railFitted(state, all, height)
    const lead = said.length + (state.layersStale ? 1 : 0) + (window.above > 0 ? 1 : 0)
    this.listPicks = [
      ...Array.from({ length: lead }, () => ({ pane: "tree" as const })),
      ...window.rows.map((row) => ({
        pane: "tree" as const,
        file: row.fileIndex,
        layer: row.index,
      })),
    ]
    const rows = window.rows.flatMap((row) => this.layerLine(state, row, room))
    const above =
      window.above > 0 ? [fg(palette.faint)(` ▲ ${window.above} more\n`)] : []
    const more = window.more > 0 ? [fg(palette.faint)(` ▼ ${window.more} more`)] : []
    const warn = state.layersStale ? [fg(palette.attention)(`${staleBanner(room.title)}\n`)] : []
    const told = said.map((line) => fg(palette.muted)(`${line}\n`))
    return new StyledText([...told, ...warn, ...above, ...rows, ...more])
  }

  private layerLine(
    state: TuiState,
    row: LayerRow,
    room: LayerRoom,
  ): ReadonlyArray<TextChunk> {
    const look = layerLook(state, row)
    const drawn = layerText(row, look, room)
    const body = fg(look.paint)(`${drawn.slice(1)}\n`)
    const mark = fg(row.here === true ? palette.marker : palette.faint)(drawn.slice(0, 1))
    return [mark, litRow(row, state, body)]
  }

  private railFitted(
    state: TuiState,
    all: ReadonlyArray<LayerRow>,
    height: number,
  ): RailWindow {
    const whole = railWindow(all, height, state.layerIndex, state.railScroll)
    if (whole.more === 0 && whole.above === 0) return whole
    const once = railWindow(all, Math.max(1, height - 1), state.layerIndex, state.railScroll)
    if (once.above === 0 || once.more === 0) return once
    return railWindow(all, Math.max(1, height - 2), state.layerIndex, state.railScroll)
  }

  private paintDiff(state: TuiState): void {
    const shown = shownOf(state)
    if (shown === undefined) return
    const patch = shown.patch
    this.view.setWrap(state.wrap, this.diffRoom())
    this.view.setPan(state.pan)
    const draft = this.draftFor(state)
    this.drafted = draft
    this.view.show(patch, notesFor(state, patch.path), gapRowSet(shown), {
      prose: proseFor(state, patch.path),
      draft,
    })
    this.view.pick(state.picked)
    if (!takesText(state.screen)) {
      this.view.fit(this.diffRows())
      this.lastTop = this.view.scrollTo(state.top, state.cursor, state.scroll)
      if (state.sticky) this.paintSticky(state, this.view.rowAt(this.lastTop))
      else this.view.pin([])
    } else if (draft !== undefined) {
      this.view.fit(this.diffRows())
      const held = state.scroll >= 0 && this.drafting === draft.row ? state.scroll : this.lastTop
      this.lastTop = this.view.showDraft(held, draft.rows)
      this.drafting = draft.row
    }
    if (draft === undefined) this.drafting = undefined
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
    stack(this.compose, [this.composeTitle, this.composeQuoted, this.composeBody, this.composeActions])
    stack(renderer.root, [
      this.cramped,
      this.header,
      this.body,
      this.footer,
      this.scrim,
      this.compose,
      this.palette,
      this.foundBox.box,
      this.keys,
      this.settings,
      this.reader.box,
      this.ask.box,
      this.baseBox.box,
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
    const pane = this.homeRoom(state)
    const room = nameRoom(pane, longestName(state))
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
        fg(palette.attention)(`   ${clip(stateCell(state, branch), stateRoom(pane, room))}\n`),
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
    if (this.shown !== undefined) this.footer.content = this.footerText(this.shown)
  }

  private homeRoom(state: TuiState): number {
    return homeWidth(this.renderer.width, longestName(state), longestState(state))
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
    this.foundBox.box.visible = state.screen === "search"
    if (state.screen !== "search") {
      this.foundBox.title.content = ""
      this.foundBox.peek.content = ""
      this.foundBox.choices.content = ""
      return
    }
    const room = panelWidth(this.renderer.width)
    const wide = Math.max(1, room - MODAL_ROOM)
    this.foundBox.title.content = foundTitle(state, wide)
    const shown = shownMatches(state)
    const most = panelRows(this.renderer.height, PANEL_FIFTH)
    const { blocks, chosen } = foundBlocks(state, shown, wide)
    const tall = Math.max(FOUND_LEAST, most - PALETTE_CHROME)
    const window = windowedBlocks(blocks, chosen, tall)
    this.foundBox.choices.content =
      blocks.length === 0
        ? new StyledText([fg(palette.faint)(nothingYet(state, wide))])
        : new StyledText([...window.chunks])
    this.foundBox.peek.content = ""
    this.foundBox.peek.height = 0
    this.foundBox.box.height = Math.min(most, Math.max(FOUND_LEAST, window.rows) + PALETTE_CHROME)
    this.foundBox.box.width = room
    this.foundBox.box.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.foundBox.box.top = panelTop(this.renderer.height, PANEL_FIFTH)
  }

  private paintReport(state: TuiState): void {
    this.compose.visible = state.screen === "compose" || state.screen === "report"
    if (state.screen !== "report") return
    this.asBox()
    const room = composeRoom(this.renderer.width)
    const asked = state.reportFull
      ? "What went wrong? Everything on screen is attached for you."
      : "What went wrong? Only what you type is sent."
    const lead = laidOut([asked], room.text)
    this.composeTitle.content = "Report a bug"
    this.composeQuoted.content = lead.join("\n")
    this.composeQuoted.height = lead.length
    const spare = this.renderer.height - lead.length - COMPOSE_ACTION_ROWS - COMPOSE_CHROME - COMPOSE_EDGE
    const written = this.fitBody(state, room.text, Math.max(1, spare))
    this.composeActions.content = reportActions(state.reportFull)
    this.compose.height = lead.length + written + COMPOSE_ACTION_ROWS + COMPOSE_CHROME
    this.compose.width = room.box
    this.compose.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room.box) / 2))
    this.compose.top = Math.max(2, Math.floor(this.renderer.height / 4))
  }

  private paintGutter(state: TuiState, top: number, height: number): void {
    const [from, to] = selectionRange(state)
    const marked = markedStands(state)
    const drawn = this.view.drawn()
    const bare = (visual: number): boolean =>
      visual >= drawn || !this.view.carries(visual) || this.view.isRunOn(visual)
    const held = (visual: number): string => {
      const row = this.view.rowAt(visual)
      const onCode = this.view.stopAt(visual) === 0
      const standing = row === state.cursor && this.view.stopAt(visual) === state.stop
      const within = onCode && inRange(state, row, from, to)
      const stand = onCode ? marked.get(row) : undefined
      return `${standing || within ? marks().cursor : " "}${stand === undefined ? " " : standMark(stand)}`
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

  private draftFor(state: TuiState): Draft | undefined {
    if (state.screen !== "compose") return undefined
    if (this.diffRows() < DRAFT_ROOM) return undefined
    const place = draftPlace(state)
    if (place === undefined || this.view.screenRowOf(place.row) === undefined) return undefined
    const body = this.draftBody(state)
    return {
      row: place.row,
      stop: place.stop,
      rows: DRAFT_HEAD + body + COMPOSE_ACTION_ROWS,
      head: clip(composeTarget(state), this.draftRoom()),
    }
  }

  private draftRoom(): number {
    return Math.max(NOTE_ROOM_MIN, this.view.noteWidth() - DRAFT_PAD)
  }

  private draftBody(state: TuiState): number {
    const most = Math.max(1, this.diffRows() - DRAFT_HEAD - COMPOSE_ACTION_ROWS - 1)
    return Math.max(1, Math.min(most, laidDraft(state.draft, this.draftRoom()).length))
  }

  private paintInline(state: TuiState, draft: Draft): void {
    const at = this.view.draftTop()
    if (at === undefined) return
    this.asNote()
    this.composeTitle.content = ""
    this.composeTitle.height = 0
    this.composeQuoted.content = ""
    this.composeQuoted.height = 0
    this.fitBody(state, this.draftRoom(), draft.rows - DRAFT_HEAD - COMPOSE_ACTION_ROWS)
    this.composeActions.content = actionsText(state.answerTo === undefined ? SENDS : REPLIES)
    this.compose.height = draft.rows - DRAFT_HEAD
    this.compose.width = this.draftRoom()
    this.compose.left = this.view.saidLeft()
    const top = this.view.screenTop()
    const lowest = top + Math.max(0, this.view.rows() - draft.rows + DRAFT_HEAD)
    this.compose.top = Math.max(top, Math.min(lowest, top + at + DRAFT_HEAD - this.lastTop))
  }

  private asNote(): void {
    if (this.compose.border !== false) {
      this.compose.border = false
      this.compose.paddingLeft = 0
      this.compose.paddingRight = 0
      this.compose.paddingTop = 0
      this.compose.backgroundColor = "transparent"
      this.composeBody.backgroundColor = "transparent"
      this.composeBody.focusedBackgroundColor = "transparent"
    }
  }

  private asBox(): void {
    if (this.compose.border === false) {
      this.compose.border = ["left"]
      this.compose.paddingLeft = GUTTER_X
      this.compose.paddingRight = GUTTER_X
      this.compose.paddingTop = 1
      this.compose.backgroundColor = palette.panel
      this.composeBody.backgroundColor = palette.panel
      this.composeBody.focusedBackgroundColor = palette.panel
      this.composeTitle.height = 1
    }
  }

  private fitBody(state: TuiState, room: number, most: number): number {
    if (this.composeBody.width !== room) this.composeBody.width = room
    const wanted = Math.max(1, laidDraft(state.draft, room).length)
    const rows = Math.max(1, Math.min(most, wanted))
    if (this.composeBody.height !== rows) this.composeBody.height = rows
    return rows
  }

  private paintCompose(state: TuiState): void {
    this.compose.visible = state.screen === "compose"
    if (state.screen !== "compose") return
    const inline = this.drafted
    if (inline !== undefined) {
      this.paintInline(state, inline)
      return
    }
    this.asBox()
    const room = composeRoom(this.renderer.width)
    const shownLines = Math.max(1, Math.min(SNIPPET_LINES, Math.floor(this.renderer.height / 6)))
    const quoted = quotedFor(state, shownLines, room.text)
    this.composeTitle.content = clip(composeTarget(state), room.text)
    this.composeQuoted.content = [...quoted, ""].join("\n")
    this.composeQuoted.height = quoted.length + 1
    const spare =
      this.renderer.height - quoted.length - 1 - COMPOSE_ACTION_ROWS - COMPOSE_CHROME - COMPOSE_EDGE
    const written = this.fitBody(state, room.text, Math.max(1, spare))
    this.composeActions.content = actionsText(state.answerTo === undefined ? SENDS : REPLIES)
    const height = quoted.length + 1 + written + COMPOSE_ACTION_ROWS + COMPOSE_CHROME
    this.compose.height = height
    this.compose.width = room.box
    this.compose.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room.box) / 2))
    this.compose.top = Math.max(2, Math.floor((this.renderer.height - height) / 2))
  }
}
