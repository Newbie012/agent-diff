import type {
  BoxRenderable,
  TextRenderable} from "@opentui/core";
import { type CliRenderer, type MouseEvent, type Renderable } from "@opentui/core"
import type {
  ASCIIFontRenderable,
  TextareaRenderable} from "@opentui/core";
import { bg, fg, StyledText, t, type TextChunk } from "@opentui/core"
import { stickyChain } from "../domain/patch/index.ts"
import { hintsFor, takesText } from "./command.ts"
import {
  newLineAt,
  isPicking,
  refNoteOf,
  refsShown,
  selectionRange,
  shownMatches,
} from "./cursor.ts"
import { DiffView, type Draft, type LinePaint } from "./diffview.ts"
import { treeWindow } from "./files.ts"
import { CHIP_GAP, keptWithin } from "./footer.ts"
import { FOUND_LEAST, foundBlocks, foundTitle, nothingYet, windowedBlocks } from "./found.ts"
import { gapRowSet, shownOf } from "./gaps.ts"
import {
  atHome,
  branchCells,
  branchHeading,
  elide,
  EMPTY_LIST,
  fallbackScope,
  headerFitted,
  headerParts,
  headerRoom,
  HOME_PATH_CHROME,
  HOME_PATH_MIN,
  homeWidth,
  longestName,
  longestState,
  nameRoom,
  shortPath,
  stateCell,
  stateRoom,
  summaryLines,
} from "./home.ts"
import {
  layerFitted,
  type LayerRoom,
  layerRoomIn,
  proseFor,
  railWindow,
  type RailWindow,
} from "./layerview.ts"
import {
  FRAME_PAD,
  wrappedDraft,
  panelShown,
  reviewWidth,
  selectionReadout,
  tooSmall,
  treeWidth,
} from "./layout.ts"
import { marks, standMark } from "./marks.ts"
import { askedRows, askingWords, composeTarget, draftPlace, markedStands } from "./notes.ts"
import {
  COMPOSE_ACTION_ROWS,
  COMPOSE_CHROME,
  DRAFT_HEAD,
  DRAFT_PAD,
  DRAFT_ROOM,
  NOTE_ROOM_MIN,
  REPLIES,
  SENDS,
  SNIPPET_LINES,
  actionsText,
  clipMiddle,
  clipPath,
  composeRoom,
  laidOut,
  notesFor,
  quotedFor,
  reportActions,
} from "./notespane.ts"
import { pickPaint } from "./paint.ts"
import { panelEntry } from "./panel.ts"
import { lostCode, panelText, restingOrHere } from "./panelpane.ts"
import {
  bar,
  type BaseParts,
  crampedBar,
  type FoundParts,
  frameRoot,
  makeBody,
  makeCompose,
  makeComposeParts,
  makeDiffPane,
  makeGutter,
  makeHome,
  makeListParts,
  makeModals,
  makePanel,
  makeScrim,
  makeScroll,
  makeScroller,
} from "./parts.ts"
import { keyMatches, paletteMatches } from "./reduce.ts"
import {
  askText,
  commandRow,
  LEGEND_ROWS,
  legendText,
  offeredIn,
  PALETTE_CHROME,
  PENDING_CHROME,
  pickedTail,
  pickingTitle,
  readerText,
  readerTitle,
  settingsText,
  sheetDeep,
  sheetText,
  voicesOf,
} from "./sheets.ts"
import {
  type Clicked,
  type LayerRow,
  onLayers,
  preferenceRows,
  selectedBranch,
  selectedPatch,
  type Spot,
  type TuiState,
} from "./state.ts"
import { inRange, layerLook, layerText, litRow, staleBanner, treeLine } from "./treepane.ts"
import { clip } from "./words.ts"
import {
  ASKING,
  COMPOSE_EDGE,
  CRAMPED,
  DIFF_CHROME_MOST,
  DIFF_FLOOR,
  GUTTER_X,
  MODAL_ROOM,
  type Mouse,
  notchOf,
  PANE_CHROME,
  PANE_EDGES,
  PANE_INSET,
  PANEL_FIFTH,
  PANEL_QUARTER,
  panelRows,
  panelTop,
  panelWidth,
  type Screened,
  STICKY_MAX,
} from "./chrome.ts"
import { unaskedForge } from "./home.ts"
import { keysTitle, listText } from "./sheets.ts"
import { palette } from "./theme.ts"

const stack = (parent: Renderable, children: ReadonlyArray<Renderable>): void => {
  for (const child of children) parent.add(child)
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
    box.onMouseScroll = (event) => {
      const notch = notchOf(event)
      if (notch !== undefined) this.mouse?.onRail(notch)
    }
  }

  private wheelOnSheet(box: BoxRenderable): void {
    box.onMouseScroll = (event) => {
      const notch = notchOf(event)
      if (notch !== undefined) this.mouse?.onScroll(notch)
    }
  }

  private clickIn(
    box: TextRenderable,
    picks: () => ReadonlyArray<Clicked>,
    pane: "tree" | "review",
  ): (event: MouseEvent) => void {
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
    if (cramped) this.cramped.content = CRAMPED
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
    this.baseBox.box.visible = isPicking(state)
    if (!isPicking(state)) {
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
          ` ${ref}${refNoteOf(state, ref).length === 0 ? "" : `  ${refNoteOf(state, ref)}`}${pickedTail(state, ref, typed)}`,
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
    const asked = askingWords(state)
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
    strip.onMouseMove = (event) => this.hover(event.x - strip.x - this.lead)
    strip.onMouseOut = () => this.hover(-1)
    strip.onMouseDown = (event) => {
      this.hover(event.x - strip.x - this.lead)
      const chip = this.chips[this.hovered]
      if (chip !== undefined) this.mouse?.onChip(chip.press)
    }
    const row = this.landingKeys
    row.onMouseMove = (event) => this.hover(event.x - row.x)
    row.onMouseOut = () => this.hover(-1)
    row.onMouseDown = (event) => {
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
    return Math.max(1, Math.min(most, wrappedDraft(state.draft, this.draftRoom()).length))
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
    const wanted = Math.max(1, wrappedDraft(state.draft, room).length)
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
