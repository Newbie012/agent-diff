import {
  BoxRenderable,
  SelectRenderable,
  RGBA,
  TextRenderable,
  type CliRenderer,
} from "@opentui/core"
import { ASCIIFontRenderable, bg, fg, StyledText, t } from "@opentui/core"
import { hintsFor } from "./command.ts"
import { stickyChain, type RowKind } from "../domain/patch/index.ts"
import { DiffView, type LinePaint, type Note } from "./diffview.ts"
import { paletteMatches } from "./reduce.ts"
import {
  composeTarget,
  commentsOn,
  hiddenLines,
  isReviewed,
  markedRows,
  newLineAt,
  onSteps,
  railWindow,
  selectionReadout,
  stepOpen,
  stepRows,
  type StepRow,
  wrapped,
  snippetOf,
  reviewedCount,
  selectedBranch,
  selectedPatch,
  selectionRange,
  treeWindow,
  type TuiState,
  WHOLE_FILE,
  type StagedComment,
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
const COMPOSE_PAD = 5
const COMPOSE_MIN_TEXT = 8

const reportActions = (): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)("copy and save")}`

const actionsText = (): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^a")} ${fg(palette.muted)("add to review")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)("comment now")}`
const SNIPPET_LINES = 4
const PALETTE_MAX = 18
const PALETTE_CHROME = 4
const PENDING_CHROME = 3
const PALETTE_WIDTH = 76
const TREE_MAX = 34
const TREE_MIN = 18
const TREE_SHARE = 0.3
const DIFF_MIN = 24
const BODY_BORDER = 2
const PANE_CHROME = 3
const BRANCH_WIDTH = 82
const BRANCH_NAME = 44
const BRANCH_NAME_MIN = 12
const BRANCH_TAIL = 35
const MODAL_MARGIN = 4

const bodyRoom = (width: number): number => Math.max(0, width - FRAME_PAD * 2 - BODY_BORDER)

const treeWidth = (width: number): number => {
  const room = bodyRoom(width)
  const wanted = Math.min(TREE_MAX, Math.max(TREE_MIN, Math.floor(room * TREE_SHARE)))
  return Math.max(0, Math.min(wanted, room - DIFF_MIN))
}

const homeWidth = (width: number): number =>
  Math.max(0, Math.min(BRANCH_WIDTH, width - FRAME_PAD * 2))

const modalWidth = (width: number, wanted: number): number =>
  Math.max(0, Math.min(wanted, width - MODAL_MARGIN))

type ComposeRoom = { readonly box: number; readonly text: number }

const composeRoom = (width: number): ComposeRoom => {
  const box = modalWidth(width, COMPOSE_WIDTH)
  return { box, text: Math.max(COMPOSE_MIN_TEXT, box - COMPOSE_PAD) }
}

const laidOut = (lines: ReadonlyArray<string>, room: number): ReadonlyArray<string> =>
  lines.flatMap((line) => {
    const parts = wrapped(line, room)
    return parts.length === 0 ? [""] : parts
  })

const STICKY_MAX = 4

type PaintFlags = { readonly cursor: boolean; readonly selected: boolean }

const pickPaint = (view: DiffView, kind: RowKind, flags: PaintFlags): LinePaint | undefined => {
  if (flags.cursor) return { gutter: ACCENT, content: CURSOR }
  if (flags.selected) return { gutter: SELECTION, content: SELECTION }
  return view.washOf(kind)
}

const SELECTION = RGBA.fromHex(palette.selection)
const CURSOR = RGBA.fromHex(palette.cursor)
const ACCENT = RGBA.fromHex(palette.accent)

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
    border: ["right"],
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
  box.height = PALETTE_MAX
  box.width = PALETTE_WIDTH
  return box
}

type PaletteParts = {
  readonly box: BoxRenderable
  readonly title: TextRenderable
  readonly query: TextRenderable
  readonly choices: SelectRenderable
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

const makePendingParts = (renderer: CliRenderer): PaletteParts => {
  const parts = makePaletteParts(renderer)
  parts.box.id = "pending"
  parts.query.height = 0
  return parts
}

const makeChoices = (renderer: CliRenderer): SelectRenderable =>
  new SelectRenderable(renderer, {
    id: "palette-choices",
    flexGrow: 1,
    options: [],
    showDescription: false,
    showScrollIndicator: true,
    showSelectionIndicator: true,
    wrapSelection: false,
    backgroundColor: palette.panel,
    textColor: palette.ink,
    descriptionColor: palette.faint,
    selectedBackgroundColor: palette.selection,
    selectedTextColor: palette.ink,
    selectedDescriptionColor: palette.ink,
  })

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
  staged: makePendingParts(renderer),
})

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

const treeLabel = (state: TuiState, row: TreeRow): string => {
  const indent = "  ".repeat(row.depth)
  if (row.kind === "file") return `${indent}  ${marks().file} ${row.name}`
  const shut = state.closed.includes(row.path)
  return `${indent}${shut ? "▸" : "▾"} ${shut ? marks().folder : marks().folderOpen} ${row.name}`
}

const waitingLabel = (branch: TuiState["branches"][number]): string => {
  if (branch.staged > 0) return `${branch.staged} staged`
  return branch.unread > 0 ? `${branch.unread} unread` : ""
}

const notesOf = (
  comments: ReadonlyArray<StagedComment>,
  path: string,
  sent: boolean,
): ReadonlyArray<Note> =>
  comments
    .filter((entry) => entry.file === path)
    .map((entry) => ({ side: entry.side, line: entry.end, body: entry.body, sent }))

const notesFor = (state: TuiState, path: string): ReadonlyArray<Note> => [
  ...notesOf(state.sent, path, true),
  ...notesOf(state.pending, path, false),
]

const shortPath = (path: string): string => {
  const home = process.env["HOME"] ?? ""
  return home.length > 0 && path.startsWith(home) ? `~${path.slice(home.length)}` : path
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
  readonly state: string
}

const nameRoom = (pane: number): number =>
  Math.max(BRANCH_NAME_MIN, Math.min(BRANCH_NAME, pane - BRANCH_TAIL))

const columns = (cells: Cells, room: number): string =>
  `${clip(cells.name, room).padEnd(room)}${cells.files.padStart(5)}${cells.added.padStart(8)}${cells.gone.padStart(8)}   ${cells.state}`

const branchHeading = (room: number): string =>
  `  ${columns({ name: "WORKTREE", files: "FILES", added: "+", gone: "-", state: "STATE" }, room)}`

const atHome = (state: TuiState): boolean =>
  state.screen === "branches" || (state.screen === "palette" && state.returnTo === "branches")

const branchCells = (branch: TuiState["branches"][number], here: boolean, room: number) => ({
  lead: `${here ? marks().cursor : " "} `,
  name: clip(branch.branch, room).padEnd(room),
  files: `${branch.files}`.padStart(5),
  added: `+${branch.added}`.padStart(8),
  gone: `-${branch.removed}`.padStart(8),
  state: waitingLabel(branch).trim(),
})

const headerParts = (state: TuiState, branch: string, path: string): ReadonlyArray<string> => [
  branch,
  path,
  `${state.patchIndex + 1}/${state.patches.length}`,
  state.vouched.length === 0 ? "" : reviewedCount(state),
  state.staged === 0 ? "" : `${state.staged} staged`,
  contextLabel(state.context),
  hiddenLines(state) === 0 ? "" : `⋯ ${hiddenLines(state)} lines hidden`,
]

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
  return `${treeMarks(state, row)}${clip(treeLabel(state, row), room).padEnd(room)}${tail}`
}

const STEP_NUMBER = 3
const STEP_LEAD = 8
const NOTE_LEAD = 10
const STEP_GAP = 1

type StepRoom = { readonly title: number; readonly note: number; readonly tally: number }

const stepRoom = (state: TuiState, pane: number): StepRoom => {
  const tally = Math.max(1, ...state.steps.map((step) => `${step.files.length}`.length))
  return {
    title: Math.max(4, pane - PANE_CHROME - STEP_LEAD - STEP_GAP - tally),
    note: Math.max(4, pane - PANE_CHROME - NOTE_LEAD),
    tally,
  }
}

const stepFold = (state: TuiState, index: number): string => {
  if (stepOpen(state, index)) return "▾"
  return (state.steps[index]?.note ?? "").length === 0 ? " " : "▸"
}

const stepHead = (state: TuiState, row: StepRow): string => {
  if (!row.lead) return " ".repeat(STEP_LEAD)
  const here = row.index === state.stepIndex
  const mark = here ? (state.focus === "tree" ? "▸" : "·") : " "
  return `${mark} ${stepFold(state, row.index)} ${`${row.index + 1}.`.padStart(STEP_NUMBER)} `
}

const stepText = (state: TuiState, row: StepRow, room: StepRoom): string => {
  if (row.kind === "note") return `${" ".repeat(NOTE_LEAD)}${row.text}`
  const count = row.lead ? `${state.steps[row.index]?.files.length ?? 0}` : ""
  const tail = count.padStart(room.tally + STEP_GAP)
  return `${stepHead(state, row)}${row.text.padEnd(room.title)}${tail}`
}

const stepPaint = (state: TuiState, row: StepRow): string => {
  if (row.kind === "note") return palette.faint
  return row.index === state.stepIndex ? palette.ink : palette.muted
}

export type Mouse = {
  readonly onScroll: (delta: number) => void
  readonly onDrag: (from: number, to: number, done: boolean) => void
  readonly onChip: (key: string) => void
}

export class Screen {
  private readonly header: TextRenderable
  private readonly body: BoxRenderable
  private readonly listPane: BoxRenderable
  private readonly list: TextRenderable
  private readonly diffPane: BoxRenderable
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
  private readonly paletteChoices: SelectRenderable
  private readonly pending: BoxRenderable
  private readonly pendingTitle: TextRenderable
  private readonly pendingChoices: SelectRenderable

  private readonly renderer: CliRenderer

  private mouse: Mouse | undefined
  private dragFrom: number | undefined
  private lastTop = 0

  constructor(renderer: CliRenderer, repo = "") {
    this.renderer = renderer
    this.repo = repo
    renderer.root.flexDirection = "column"
    renderer.root.paddingLeft = FRAME_PAD
    renderer.root.paddingRight = FRAME_PAD
    renderer.root.paddingTop = FRAME_PAD
    renderer.root.paddingBottom = FRAME_PAD

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
    this.pending = modals.staged.box
    this.pendingTitle = modals.staged.title
    this.pendingChoices = modals.staged.choices

    this.assemble(renderer)
  }

  listen(mouse: Mouse): void {
    this.mouse = mouse
    this.view.listenTo({
      scroll: (delta) => this.mouse?.onScroll(delta),
      down: (y) => {
        this.dragFrom = this.rowAtY(y)
        this.mouse?.onDrag(this.dragFrom, this.dragFrom, false)
      },
      drag: (y) => {
        if (this.dragFrom === undefined) return
        this.mouse?.onDrag(this.dragFrom, this.rowAtY(y), false)
      },
      dragEnd: (y) => {
        if (this.dragFrom === undefined) return
        this.mouse?.onDrag(this.dragFrom, this.rowAtY(y), true)
        this.dragFrom = undefined
      },
    })
  }

  private rowAtY(y: number): number {
    return this.view.rowAt(Math.max(0, y - this.view.screenTop() + this.lastTop))
  }

  viewportRows(): number {
    return this.diffRows()
  }

  private diffRows(): number {
    return Math.max(1, this.diffScroll.height)
  }

  update(state: TuiState): void {
    this.shown = state
    this.chips = hintsFor(state.screen, state.staged)
    this.header.content = this.headerText(state)
    this.footer.content = this.footerText(state)
    this.list.content = this.listText(state)
    const many = state.branches.length === 1 ? "1 worktree" : `${state.branches.length} worktrees`
    this.landing.content = `${shortPath(this.repo)}  ·  ${many}`
    this.landingKeys.content = this.chipRow()
    this.diffPane.visible = state.screen !== "branches" && !(state.screen === "palette" && state.returnTo === "branches")
    if (this.diffPane.visible) this.paintDiff(state)
    this.paintPane(state)
    this.paintCompose(state)
    this.paintPalette(state)
    this.paintPending(state)
    this.paintReport(state)
    this.scrim.visible = state.screen !== "branches" && state.screen !== "review"
  }

  private paintPalette(state: TuiState): void {
    this.palette.visible = state.screen === "palette"
    if (state.screen !== "palette") {
      this.paletteQuery.content = ""
      this.paletteTitle.content = ""
      this.paletteChoices.options = []
      return
    }
    const matches = paletteMatches(state)
    this.paletteTitle.content = matches.length === 0 ? "No command matches" : "Commands"
    this.paletteQuery.content =
      state.query.length === 0 ? "Type to filter…" : `${state.query}▏`
    this.paletteChoices.options = matches.map((entry) => ({
      name: `${entry.title.padEnd(34)}${entry.category}`,
      description: "",
      value: entry.action,
    }))
    const room = modalWidth(this.renderer.width, PALETTE_WIDTH)
    this.paletteChoices.selectedIndex = Math.min(state.paletteIndex, Math.max(0, matches.length - 1))
    this.palette.height = Math.min(PALETTE_MAX, matches.length + PALETTE_CHROME)
    this.palette.width = room
    this.palette.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.palette.top = Math.max(2, Math.floor(this.renderer.height / 4))
  }

  private headerText(state: TuiState): StyledText {
    const branch = selectedBranch(state)
    if (atHome(state)) {
      return t`${fg(palette.faint)("")}`
    }
    const patch = selectedPatch(state)
    const [name = "", ...rest] = headerParts(state, branch?.branch ?? "", patch?.path ?? "").filter(
      (part) => part.length > 0,
    )
    return t`${fg(palette.ink)(name)}  ${fg(palette.muted)(rest.join("  "))}`
  }

  private footerText(state: TuiState): StyledText {
    const readout = selectionReadout(state)
    this.lead = readout.length === 0 ? 0 : readout.length + 3
    const lead = readout.length === 0 ? [] : [fg(palette.muted)(`${readout}   `)]
    const notice = state.notice.length === 0 ? [] : [fg(palette.attention)(`  ${state.notice}`)]
    return new StyledText([...lead, ...this.chipRow().chunks, ...notice])
  }

  private paneRoom(): number {
    return treeWidth(this.renderer.width)
  }

  private listText(state: TuiState): string | StyledText {
    if (atHome(state)) return this.branchTable(state)
    if (onSteps(state)) return this.stepRail(state)
    const height = Math.max(1, this.listPane.height - 1)
    const pane = this.paneRoom()
    const window = treeWindow(state, height)
    const rows = window.rows.flatMap((row) => [
      fg(row.kind === "file" ? palette.ink : palette.muted)(`${treeLine(state, row, pane)}\n`),
    ])
    const more = window.more > 0 ? [fg(palette.faint)(` … ${window.more} more`)] : []
    return new StyledText([...rows, ...more])
  }

  private stepRail(state: TuiState): StyledText {
    const height = Math.max(1, this.listPane.height - 1)
    const room = stepRoom(state, this.paneRoom())
    const window = railWindow(stepRows(state, room.title, room.note), height, state.stepIndex)
    const rows = window.rows.map((row) =>
      fg(stepPaint(state, row))(`${stepText(state, row, room)}\n`),
    )
    const more = window.more > 0 ? [fg(palette.faint)(` … ${window.more} more`)] : []
    return new StyledText([...rows, ...more])
  }

  private paintDiff(state: TuiState): void {
    const patch = selectedPatch(state)
    if (patch === undefined) return
    this.paintSticky(state, state.top)
    this.view.show(patch, notesFor(state, patch.path))
    this.view.fit(this.diffScroll.height)
    const height = this.view.rows()
    const top = this.view.scrollTo(state.top, state.cursor)
    this.lastTop = top
    this.view.paint(this.linePaint(state), top, height)
    this.paintGutter(state, top, height)
  }

  private paintPending(state: TuiState): void {
    this.pending.visible = state.screen === "pending"
    if (state.screen !== "pending") {
      this.pendingTitle.content = ""
      this.pendingChoices.options = []
      return
    }
    const count = state.pending.length
    const room = modalWidth(this.renderer.width, PALETTE_WIDTH)
    this.pendingTitle.content = `Review — ${count} comment${count === 1 ? "" : "s"}, one wake-up`
    this.pendingChoices.options = state.pending.map((entry) => ({
      name: clip(
        `${entry.file}:${entry.start}-${entry.end}  ${entry.body.split("\n")[0] ?? ""}`,
        Math.max(1, room - MODAL_ROOM),
      ),
      description: "",
      value: entry.file,
    }))
    this.pendingChoices.selectedIndex = state.pendingIndex
    this.pending.height = Math.min(PALETTE_MAX, state.pending.length + PENDING_CHROME)
    this.pending.width = room
    this.pending.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room) / 2))
    this.pending.top = Math.max(2, Math.floor(this.renderer.height / 4))
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
    stack(this.compose, [this.composeTitle, this.composeBody, this.composeActions])
    stack(renderer.root, [
      this.header,
      this.body,
      this.footer,
      this.scrim,
      this.compose,
      this.palette,
      this.pending,
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
    const room = nameRoom(homeWidth(this.renderer.width))
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
        fg(palette.attention)(`   ${cells.state}\n`),
      ]
    })
    return new StyledText([...heading, ...rows])
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

  private chipRow(): StyledText {
    return new StyledText(
      this.chips.flatMap((chip, index) => {
        const paint = index === this.hovered ? bg(palette.cursor) : fg(palette.faint)
        return [
          index === this.hovered ? paint(` ${chip.key} ${chip.hint} `) : fg(palette.ink)(chip.key),
          index === this.hovered ? fg(palette.faint)("  ") : fg(palette.faint)(` ${chip.hint}   `),
        ]
      }),
    )
  }

  private paintPane(state: TuiState): void {
    const onBranches = atHome(state)
    const inset = onBranches ? 0 : 1
    this.listPane.width = onBranches ? homeWidth(this.renderer.width) : this.paneRoom()
    this.listPane.visible = onBranches || state.navOpen
    this.listPane.border = onBranches ? [] : ["right"]
    this.listPane.paddingLeft = inset
    this.listPane.paddingRight = inset
    this.listPane.paddingTop = inset
    this.listPane.marginRight = 0
    this.diffPane.paddingLeft = inset
    this.list.flexGrow = inset
    this.paintChrome(onBranches)
  }

  private paintChrome(onBranches: boolean): void {
    const place = onBranches ? "center" : "flex-start"
    this.body.border = onBranches ? [] : true
    this.body.borderStyle = "rounded"
    this.body.borderColor = palette.rule
    this.listPane.borderColor = palette.rule
    this.listPane.backgroundColor = "transparent"
    this.logo.visible = onBranches
    this.landing.visible = onBranches
    this.landingKeys.visible = onBranches
    this.footer.visible = !onBranches
    this.body.justifyContent = place
    this.listPane.justifyContent = place
  }

  private paintReport(state: TuiState): void {
    this.compose.visible = state.screen === "compose" || state.screen === "report"
    if (state.screen !== "report") return
    const room = composeRoom(this.renderer.width)
    const lines = laidOut(
      ["What went wrong? Everything on screen is attached for you.", "", `${state.draft}▌`],
      room.text,
    )
    this.composeTitle.content = "Report a bug"
    this.composeBody.content = lines.join("\n")
    this.composeActions.content = reportActions()
    this.compose.height = lines.length + COMPOSE_ACTION_ROWS + COMPOSE_CHROME
    this.compose.width = room.box
    this.compose.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room.box) / 2))
    this.compose.top = Math.max(2, Math.floor(this.renderer.height / 4))
  }

  private paintGutter(state: TuiState, top: number, height: number): void {
    const [from, to] = selectionRange(state)
    const marked = markedRows(state)
    const rows = Array.from({ length: height }, (_, index) => {
      if (this.view.isComment(top + index)) return `  `
      const row = this.view.rowAt(top + index)
      const here = row === state.cursor || (state.selecting && row >= from && row <= to)
      return `${here ? marks().cursor : " "}${marked.has(row) ? marks().comment : " "}`
    })
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
    const rows = selectedPatch(state)?.rows ?? []
    return (row) => {
      const kind = rows[row]?.kind
      if (kind === undefined) return undefined
      return pickPaint(this.view, kind, {
        cursor: row === state.cursor,
        selected: selecting && row >= from && row <= to,
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
    const more = selectionRange(state)[1] - selectionRange(state)[0] + 1 - snippet.length
    const tail = more > 0 ? [`     … ${more} more lines`] : []
    const quoted = [...snippet, ...tail].map((line) => clip(line, room.text))
    const written = laidOut(`${state.draft}▌`.split("\n"), room.text)
    const lines = [...quoted, "", ...written]
    this.composeTitle.content = clip(composeTarget(state), room.text)
    this.composeBody.content = lines.join("\n")
    this.composeActions.content = actionsText()
    const height = lines.length + COMPOSE_ACTION_ROWS + COMPOSE_CHROME
    this.compose.height = height
    this.compose.width = room.box
    this.compose.left = Math.max(FRAME_PAD, Math.floor((this.renderer.width - room.box) / 2))
    this.compose.top = Math.max(2, Math.floor((this.renderer.height - height) / 2))
  }
}
