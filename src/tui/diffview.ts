import {
  BoxRenderable,
  CodeRenderable,
  LineNumberRenderable,
  RGBA,
  SyntaxStyle,
  getTreeSitterClient,
  pathToFiletype,
  type CliRenderer,
} from "@opentui/core"
import { Option } from "effect"
import { lineOn, type Patch, type Row, type RowKind } from "../domain/patch/index.ts"
import { marks } from "./marks.ts"
import type { Picked } from "./model.ts"
import { palette, syntaxTheme } from "./theme.ts"

export type LinePaint = { readonly gutter: RGBA; readonly content: RGBA }

export type Prose = {
  readonly line: number
  readonly markdown: string
  readonly after: boolean
}

export type Note = {
  readonly id: string
  readonly folded: boolean
  readonly side: "old" | "new"
  readonly line: number
  readonly body: string
  readonly sent: boolean
  readonly settled: boolean
  readonly stale: boolean
  readonly asks: boolean
  readonly answers: ReadonlyArray<string>
  readonly turns: ReadonlyArray<{ readonly voice: "reviewer" | "agent"; readonly body: string }>
}

type Display = {
  readonly text: string
  readonly row: number
  readonly stop: number
  readonly comment: boolean
  readonly sent: boolean
  readonly label: boolean
  readonly gap: boolean
  readonly prose: boolean
}

const WASH: Partial<Record<RowKind, LinePaint>> = {
  added: { gutter: RGBA.fromHex(palette.addedGutter), content: RGBA.fromHex(palette.addedBg) },
  removed: {
    gutter: RGBA.fromHex(palette.removedGutter),
    content: RGBA.fromHex(palette.removedBg),
  },
}

const NOTE_MIN = 24
const ANSWER_MARK = "↳"
const REPLY_MARK = "»"
const OVERSCAN = 2
const SIGN_WIDTH = 2
const SCROLL_ROWS = 1
const PAN_COLUMNS = 8

type Wheel = {
  readonly scroll?: { readonly direction?: string; readonly delta?: number }
  readonly modifiers?: { readonly shift?: boolean }
  readonly preventDefault?: () => void
  readonly stopPropagation?: () => void
}

type Wheeled = {
  readonly scroll: (delta: number) => void
  readonly pan: (delta: number) => void
}

const WAYS: Readonly<Record<string, { readonly step: number; readonly across: boolean }>> = {
  up: { step: -1, across: false },
  down: { step: 1, across: false },
  left: { step: -1, across: true },
  right: { step: 1, across: true },
}

const notchesIn = (event: Wheel): number => Math.max(1, event.scroll?.delta ?? 1)

const takenOver = (event: Wheel): void => {
  event.preventDefault?.()
  event.stopPropagation?.()
}

const wheelTo = (event: Wheel, handlers: Wheeled): void => {
  const way = WAYS[event.scroll?.direction ?? ""]
  if (way === undefined) return
  takenOver(event)
  const step = way.step * notchesIn(event)
  if (way.across || event.modifiers?.shift === true) handlers.pan(step * PAN_COLUMNS)
  else handlers.scroll(step * SCROLL_ROWS)
}

const SIGNS: Readonly<Record<RowKind, { text: string; color: string }>> = {
  added: { text: " +", color: palette.added },
  removed: { text: " -", color: palette.removed },
  context: { text: "  ", color: palette.faint },
}

const numberFor = (row: Row): number | undefined =>
  Option.getOrUndefined(row.newLine) ?? Option.getOrUndefined(row.oldLine)

export class DiffView {
  private readonly code: CodeRenderable
  private readonly numbers: LineNumberRenderable
  private readonly pinned: CodeRenderable
  private readonly pinBox: BoxRenderable
  private pinnedText = ""
  private newLit: ReadonlyArray<ReadonlyArray<Span>> = []
  private oldLit: ReadonlyArray<ReadonlyArray<Span>> = []
  private newFor = ""
  private oldFor = ""
  private newText: ReadonlyArray<string> = []
  private oldText: ReadonlyArray<string> = []
  private shown: Patch | undefined
  private noted = ""
  private display: ReadonlyArray<Display> = []
  private starts = new Map<number, number>()
  private fitted = 1
  private wrapped = false
  private held = 0
  private picked: Picked | undefined

  constructor(renderer: CliRenderer) {
    this.code = new CodeRenderable(renderer, {
      id: "diff-code",
      content: "",
      syntaxStyle: SyntaxStyle.fromStyles(syntaxTheme),
      treeSitterClient: getTreeSitterClient(),
      drawUnstyledText: true,
      conceal: false,
      wrapMode: "none",
      width: "100%",
    })
    this.numbers = new LineNumberRenderable(renderer, {
      id: "diff-lines",
      target: this.code,
      fg: palette.faint,
      minWidth: 4,
      paddingRight: 1,
      flexGrow: 1,
      minHeight: 0,
      showLineNumbers: true,
    })
    this.numbers.add(this.code)
    this.pinned = new CodeRenderable(renderer, {
      id: "diff-pin",
      content: "",
      syntaxStyle: SyntaxStyle.fromStyles(syntaxTheme),
      treeSitterClient: getTreeSitterClient(),
      drawUnstyledText: true,
      conceal: false,
      wrapMode: "none",
      bg: palette.overlay,
      flexGrow: 1,
    })
    this.pinBox = new BoxRenderable(renderer, {
      id: "diff-pin-box",
      height: 0,
      flexShrink: 0,
      flexDirection: "row",
      backgroundColor: palette.overlay,
    })
    this.pinBox.add(this.pinned)
  }

  pinNode(): BoxRenderable {
    return this.pinBox
  }

  pinRows(): number {
    return this.pinBox.height
  }

  private noteRoom(): number {
    return Math.max(NOTE_MIN, this.code.width - this.gutterWidth() - 3)
  }

  room(): number {
    return this.noteRoom()
  }

  gutterWidth(): number {
    return Math.max(0, this.code.x - this.numbers.x) + SIGN_WIDTH
  }

  private unpin(): void {
    this.pinnedText = ""
    this.pinned.content = ""
    this.pinned.height = 0
    this.pinBox.height = 0
  }

  pin(lines: ReadonlyArray<string>): void {
    const indent = this.gutterWidth()
    if (this.pinBox.paddingLeft !== indent) this.pinBox.paddingLeft = indent
    const text = lines.join("\n")
    if (text === this.pinnedText) return
    this.pinnedText = text
    this.pinned.filetype = this.code.filetype
    this.pinned.content = text
    this.pinned.height = lines.length
    this.pinBox.height = lines.length
  }

  node(): LineNumberRenderable {
    return this.numbers
  }

  listenTo(handlers: {
    readonly scroll: (delta: number) => void
    readonly pan: (delta: number) => void
    readonly down: (y: number, x: number) => void
    readonly drag: (y: number, x: number) => void
    readonly dragEnd: (y: number, x: number) => void
  }): void {
    for (const target of [this.numbers, this.code]) {
      target.onMouseScroll = (event: Wheel) => wheelTo(event, handlers)
      target.onMouseDown = (event: { y: number; x: number }) => handlers.down(event.y, event.x)
      target.onMouseDrag = (event: { y: number; x: number }) => handlers.drag(event.y, event.x)
      target.onMouseDragEnd = (event: { y: number; x: number }) =>
        handlers.dragEnd(event.y, event.x)
      target.onMouseUp = (event: { y: number; x: number }) => handlers.dragEnd(event.y, event.x)
    }
  }

  refresh(): void {
    this.shown = undefined
    this.code.requestRender()
    this.numbers.requestRender()
  }

  screenTop(): number {
    return this.code.y
  }

  fit(height: number): void {
    const rows = Math.max(1, height)
    if (rows !== this.fitted) {
      this.fitted = rows
      this.numbers.height = rows
      this.code.height = rows
      this.code.requestRender()
      this.numbers.requestRender()
    }
  }

  rows(): number {
    return this.fitted
  }

  show(
    patch: Patch,
    notes: ReadonlyArray<Note>,
    gaps: ReadonlySet<number>,
    prose: ReadonlyArray<Prose> = [],
  ): void {
    const room = notes.length === 0 && prose.length === 0 ? NOTE_MIN : this.noteRoom()
    const key = keyOf(room, notes, prose)
    if (patch === this.shown && key === this.noted) return
    this.unpin()
    this.shown = patch
    this.noted = key
    this.display = layout({ patch, notes, room, gaps, prose })
    this.starts = startsOf(this.display)
    this.code.filetype = pathToFiletype(patch.path) ?? "text"
    this.feed()
    this.numbers.setLineNumbers(lineNumbers(patch, this.display))
    this.numbers.setHideLineNumbers(bareOf(this.display))
    this.numbers.setLineSigns(lineSigns(patch, this.display))
    this.numbers.setLineColors(new Map())
  }

  lit(
    path: string,
    side: "new" | "old",
    lines: ReadonlyArray<string>,
    found: ReadonlyArray<readonly [number, number, string, unknown?]>,
  ): void {
    const held = spansByLine(lines, found)
    if (side === "new") {
      this.newLit = held
      this.newText = lines
      this.newFor = path
    } else {
      this.oldLit = held
      this.oldText = lines
      this.oldFor = path
    }
    this.feed()
    this.code.requestRender()
  }

  private litRow(entry: Display): ReadonlyArray<Span> {
    const row = this.shown?.rows[entry.row]
    if (row === undefined) return NO_SPANS
    const fresh = Option.getOrUndefined(row.newLine)
    if (fresh !== undefined) return this.sideRow(row.text, fresh, "new")
    const gone = Option.getOrUndefined(row.oldLine)
    return gone === undefined ? NO_SPANS : this.sideRow(row.text, gone, "old")
  }

  private sideRow(text: string, line: number, side: "new" | "old"): ReadonlyArray<Span> {
    const path = side === "new" ? this.newFor : this.oldFor
    if (this.shown?.path !== path) return NO_SPANS
    const source = side === "new" ? this.newText : this.oldText
    if (!sameLine(source[line - 1], text)) return NO_SPANS
    return (side === "new" ? this.newLit : this.oldLit)[line - 1] ?? NO_SPANS
  }

  private ownSpans(): ReadonlyArray<Span> | undefined {
    if (this.shown === undefined) return undefined
    if (this.shown.path !== this.newFor && this.shown.path !== this.oldFor) return undefined
    const spans: Array<Span> = []
    let at = 0
    for (const entry of this.display) {
      const width = heldAt(entry, this.held).length
      const here = isChrome(entry) ? NO_SPANS : this.litRow(entry)
      spans.push(...shifted(here, at, width))
      at += width + 1
    }
    return spans
  }

  private hidden(): number {
    return Math.max(0, this.code.x - this.numbers.x) + SIGN_WIDTH
  }

  private pickedSpans(): ReadonlyArray<Span> {
    const picked = this.picked
    if (picked === undefined) return NO_SPANS
    let at = 0
    for (const entry of this.display) {
      const width = heldAt(entry, this.held).length
      if (entry.row === picked.row && entry.stop === 0 && !isChrome(entry)) {
        const from = Math.min(picked.from, width)
        const to = Math.min(picked.to, width)
        return from >= to ? NO_SPANS : [[at + from, at + to, "picked"]]
      }
      at += width + 1
    }
    return NO_SPANS
  }

  private feed(): void {
    const spans = [...noteSpans(this.display, this.held), ...this.pickedSpans()]
    this.code.content = textAt(this.display, this.held, this.hidden())
    this.code.onHighlight = (highlights) => {
      const own = this.ownSpans()
      const base = own ?? highlights
      return [
        ...base.filter((highlight) => !spans.some(([from, to]) => highlight[0] < to && highlight[1] > from)),
        ...spans,
      ]
    }
  }

  setWrap(on: boolean): void {
    if (on !== this.wrapped) {
      this.wrapped = on
      this.code.wrapMode = on ? "word" : "none"
      this.code.requestRender()
      this.numbers.requestRender()
    }
    this.fitWrapWidth()
  }

  panLimit(): number {
    return this.wrapped ? 0 : Math.max(this.code.maxScrollX, this.pinned.maxScrollX)
  }

  setPan(columns: number): void {
    const wanted = Math.max(0, Math.min(this.panLimit(), columns))
    if (wanted !== this.held) {
      this.held = wanted
      this.feed()
    }
    if (this.code.scrollX !== wanted) this.code.scrollX = wanted
    if (this.pinned.scrollX !== wanted) this.pinned.scrollX = wanted
  }

  private fitWrapWidth(): void {
    const room = this.numbers.width - Math.max(0, this.code.x - this.numbers.x)
    const wanted = this.wrapped && room > 0 ? room : "100%"
    if (this.code.width !== wanted) this.code.width = wanted
  }

  private sources(): ReadonlyArray<number> {
    const reported = this.code.lineInfo?.lineSources
    return this.wrapped && reported !== undefined && reported.length > 0 ? reported : []
  }

  private lineAt(visual: number): number {
    const sources = this.sources()
    if (sources.length === 0) return visual
    const at = Math.max(0, Math.min(sources.length - 1, visual))
    return sources[at] ?? visual
  }

  private visualOf(line: number): number {
    const sources = this.sources()
    if (sources.length === 0) return line
    let low = 0
    let high = sources.length
    while (low < high) {
      const mid = (low + high) >> 1
      if ((sources[mid] ?? 0) < line) low = mid + 1
      else high = mid
    }
    return low
  }

  private tallest(): number {
    return this.sources().length === 0 ? this.display.length : this.sources().length
  }

  drawn(): number {
    return this.tallest()
  }

  rowAt(visual: number): number {
    const line = this.lineAt(visual)
    const at = Math.max(0, Math.min(this.display.length - 1, line))
    return this.display[at]?.row ?? 0
  }

  stopAt(visual: number): number {
    return this.display[this.lineAt(visual)]?.stop ?? 0
  }

  carries(visual: number): boolean {
    const entry = this.display[this.lineAt(visual)]
    if (entry === undefined) return false
    if (entry.prose) return false
    return true
  }

  isComment(visual: number): boolean {
    const entry = this.display[this.lineAt(visual)]
    return entry?.comment === true || entry?.prose === true
  }

  isRunOn(visual: number): boolean {
    const sources = this.sources()
    if (sources.length === 0) return false
    return visual > 0 && sources[visual] === sources[visual - 1]
  }

  private lineOfRow(row: number): number | undefined {
    if (this.starts.size === 0) return undefined
    for (let at = Math.max(0, row); at >= 0; at -= 1) {
      const line = this.starts.get(at)
      if (line !== undefined) return line
    }
    return 0
  }

  private visualOfRow(row: number): number | undefined {
    const line = this.lineOfRow(row)
    return line === undefined ? undefined : this.visualOf(line)
  }

  tallestRows(): number {
    return this.tallest()
  }

  screenRowOf(row: number): number | undefined {
    return this.visualOfRow(row)
  }

  pick(picked: Picked | undefined): void {
    if (alike(this.picked, picked)) return
    this.picked = picked
    this.feed()
    this.code.requestRender()
  }

  columnAt(x: number): number {
    return Math.max(0, x - this.code.x + this.held)
  }

  blockAt(row: number, stop: number): { readonly start: number; readonly rows: number } {
    const first = this.display.findIndex((entry) => entry.row === row && entry.stop === stop)
    if (first === -1) return { start: 0, rows: 0 }
    let last = first
    while (this.display[last + 1]?.row === row && this.display[last + 1]?.stop === stop) last += 1
    return { start: first, rows: last - first + 1 }
  }

  scrollTo(row: number, cursor: number, held = -1): number {
    const highest = Math.max(0, this.tallest() - this.rows())
    if (held >= 0) {
      const settled = Math.max(0, Math.min(highest, held))
      if (this.code.scrollY !== settled) this.code.scrollY = settled
      return settled
    }
    const wanted = this.visualOfRow(row) ?? row
    const at = this.visualOfRow(cursor)
    const following = at !== undefined && at >= wanted
    const kept = following ? Math.max(wanted, at - this.rows() + 1) : wanted
    const clamped = Math.max(0, Math.min(highest, kept))
    if (this.code.scrollY !== clamped) this.code.scrollY = clamped
    return clamped
  }

  paint(paintOf: (row: number) => LinePaint | undefined, from: number, rows: number): void {
    const colors = new Map<number, LinePaint>()
    const first = this.lineAt(Math.max(0, from - OVERSCAN))
    const last = Math.min(this.display.length, this.lineAt(from + rows + OVERSCAN) + 1)
    for (let index = first; index < last; index++) {
      const entry = this.display[index]
      if (entry === undefined) continue
      const paint = entry.comment || entry.prose ? NOTE_PAINT : paintOf(entry.row)
      if (paint !== undefined) colors.set(index, paint)
    }
    this.numbers.setLineColors(colors)
  }

  washOf(kind: RowKind): LinePaint | undefined {
    return WASH[kind]
  }
}

const startsOf = (display: ReadonlyArray<Display>): Map<number, number> => {
  const starts = new Map<number, number>()
  for (const [index, entry] of display.entries()) {
    if (!entry.comment && !starts.has(entry.row)) starts.set(entry.row, index)
  }
  return starts
}

const bareOf = (display: ReadonlyArray<Display>): Set<number> =>
  new Set(display.flatMap((entry, index) => (entry.comment || entry.gap || entry.prose ? [index] : [])))

const keyOf = (
  room: number,
  notes: ReadonlyArray<Note>,
  prose: ReadonlyArray<Prose>,
): string =>
  [
    room,
    ...notes.map((note) => `${note.side}${note.line}:${note.folded ? "-" : "+"}${note.body}`),
    ...prose.map((entry) => `p${entry.line}${entry.after ? ">" : "<"}:${entry.markdown}`),
  ].join("\u0000")

const groupOf = (entry: Display): string | undefined => {
  if (entry.prose) return "prose"
  if (entry.gap) return "gap"
  if (!entry.comment) return undefined
  if (entry.label) return "note.label"
  return entry.sent ? "note.sent" : "note"
}

const isChrome = (entry: Display): boolean => entry.comment || entry.gap || entry.prose

const alike = (left: Picked | undefined, right: Picked | undefined): boolean =>
  left === right ||
  (left !== undefined &&
    right !== undefined &&
    left.row === right.row &&
    left.from === right.from &&
    left.to === right.to)

const heldAt = (entry: Display, pan: number): string =>
  isChrome(entry) && pan > 0 ? `${" ".repeat(pan)}${entry.text}` : entry.text

const sameLine = (source: string | undefined, row: string): boolean =>
  source !== undefined && source.trimEnd() === row.trimEnd()

export type Span = [number, number, string]

const NO_SPANS: ReadonlyArray<Span> = []

const lineStarts = (lines: ReadonlyArray<string>): ReadonlyArray<number> => {
  const starts: Array<number> = []
  let at = 0
  for (const line of lines) {
    starts.push(at)
    at += line.length + 1
  }
  return starts
}

const overLine = (start: number, starts: ReadonlyArray<number>): number => {
  let low = 0
  let high = starts.length - 1
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    if ((starts[mid] ?? 0) <= start) low = mid
    else high = mid - 1
  }
  return low
}

const shifted = (spans: ReadonlyArray<Span>, at: number, width: number): ReadonlyArray<Span> =>
  spans
    .filter(([from]) => from < width)
    .map(([from, to, group]): Span => [at + from, at + Math.min(to, width), group])

const acrossLines = (
  lines: ReadonlyArray<string>,
  starts: ReadonlyArray<number>,
  held: Array<Array<Span>>,
  span: readonly [number, number, string],
): void => {
  const [from, to, group] = span
  let at = from
  let line = overLine(at, starts)
  while (at < to && line < lines.length) {
    const start = starts[line] ?? 0
    const width = lines[line]?.length ?? 0
    const stop = Math.min(to, start + width)
    if (stop > at) held[line]?.push([at - start, stop - start, group])
    at = start + width + 1
    line += 1
  }
}

const spansByLine = (
  lines: ReadonlyArray<string>,
  found: ReadonlyArray<readonly [number, number, string, unknown?]>,
): ReadonlyArray<ReadonlyArray<Span>> => {
  const starts = lineStarts(lines)
  const held: Array<Array<Span>> = lines.map(() => [])
  for (const [from, to, group] of found) acrossLines(lines, starts, held, [from, to, group])
  return held
}

const textAt = (display: ReadonlyArray<Display>, pan: number, covered = 0): string => {
  const lines = display.map((entry) => heldAt(entry, pan))
  if (covered === 0) return lines.join("\n")
  const widest = lines.reduce((most, line) => Math.max(most, line.length), 0)
  const last = lines.length - 1
  return lines.map((line, at) => (at === last ? line.padEnd(widest + covered) : line)).join("\n")
}

const noteSpans = (
  display: ReadonlyArray<Display>,
  pan: number,
): ReadonlyArray<[number, number, string]> => {
  const spans: Array<[number, number, string]> = []
  let at = 0
  for (const entry of display) {
    const group = groupOf(entry)
    const width = heldAt(entry, pan).length
    if (group !== undefined) spans.push([at, at + width, group])
    at += width + 1
  }
  return spans
}

const NOTE_PAINT: LinePaint = {
  gutter: RGBA.fromHex(palette.overlay),
  content: RGBA.fromHex(palette.overlay),
}

const wrap = (text: string, room: number): ReadonlyArray<string> => {
  const words = text.split(/\s+/).filter((word) => word.length > 0)
  if (words.length === 0) return [""]
  const lines: Array<string> = []
  for (const word of words) {
    const last = lines.at(-1)
    if (last === undefined || `${last} ${word}`.length > room) lines.push(word)
    else lines[lines.length - 1] = `${last} ${word}`
  }
  return lines
}

const headOf = (note: Note): string => {
  const moved = note.stale ? ", the branch moved on" : ""
  if (note.settled) return `${marks().sent} settled${moved}`
  if (note.asks) return `${marks().comment} asked back${moved}`
  if (note.answers.length > 0) return `${marks().sent} answered${moved}`
  return `${marks().sent} sent${moved}`
}

const spokenLines = (body: string, room: number, mark: string): ReadonlyArray<string> => {
  const wrapped = wrap(body.replaceAll("\n", " "), Math.max(NOTE_MIN, room - 2))
  return wrapped.map((text, at) => (at === 0 ? `${mark} ${text}` : `  ${text}`))
}

const answerLines = (note: Note, room: number): ReadonlyArray<string> =>
  note.turns.length > 0
    ? note.turns.flatMap((turn) =>
        spokenLines(turn.body, room, turn.voice === "agent" ? ANSWER_MARK : REPLY_MARK),
      )
    : note.answers.flatMap((body) => spokenLines(body, room, ANSWER_MARK))

const noteLines = (note: Note, room: number): ReadonlyArray<string> =>
  note.folded
    ? [`${headOf(note)} · press l`]
    : [
        headOf(note),
        ...note.body.split("\n").flatMap((line) => wrap(line, room)),
        ...answerLines(note, room),
      ]

const noteRows = (note: Note, row: number, room: number, stop: number): ReadonlyArray<Display> =>
  noteLines(note, room).map((line, index) => ({
    text: `${marks().rule} ${line}`,
    row,
    stop,
    comment: true,
    sent: note.sent,
    label: index === 0,
    gap: false,
    prose: false,
  }))

const proseRows = (entry: Prose, row: number, room: number): ReadonlyArray<Display> =>
  [...entry.markdown.split("\n").flatMap((line) => wrap(line, room - 2)), ""].map((line) => ({
    text: line.length === 0 ? "" : `  ${line}`,
    row,
    stop: 0,
    comment: false,
    sent: false,
    label: false,
    gap: false,
    prose: true,
  }))

type Plan = {
  readonly patch: Patch
  readonly notes: ReadonlyArray<Note>
  readonly room: number
  readonly gaps: ReadonlySet<number>
  readonly prose: ReadonlyArray<Prose>
}

const proseAt = (plan: Plan, row: Row, after: boolean): ReadonlyArray<Prose> => {
  const line = sideLineOf(row, "new")
  if (line === undefined) return []
  return plan.prose.filter((entry) => entry.after === after && entry.line === line)
}

const notesAt = (plan: Plan, row: Row): ReadonlyArray<Display> =>
  plan.notes
    .filter((note) => sideLineOf(row, note.side) === note.line)
    .flatMap((note, at) => noteRows(note, row.index, plan.room, at + 1))

const codeRow = (plan: Plan, row: Row): Display => ({
  text: row.text,
  row: row.index,
  stop: 0,
  comment: false,
  sent: false,
  label: false,
  gap: plan.gaps.has(row.index),
  prose: false,
})

const rowsFor = (plan: Plan, row: Row): ReadonlyArray<Display> => [
  ...proseAt(plan, row, false).flatMap((entry) => proseRows(entry, row.index, plan.room)),
  codeRow(plan, row),
  ...notesAt(plan, row),
  ...proseAt(plan, row, true).flatMap((entry) => proseRows(entry, row.index, plan.room)),
]

const layout = (plan: Plan): ReadonlyArray<Display> =>
  plan.patch.rows.flatMap((row) => rowsFor(plan, row))

const lineNumbers = (patch: Patch, display: ReadonlyArray<Display>): Map<number, number> => {
  const numbers = new Map<number, number>()
  const rows = new Map(patch.rows.map((row) => [row.index, row]))
  for (const [index, entry] of display.entries()) {
    const row = entry.comment || entry.prose ? undefined : rows.get(entry.row)
    const line = row === undefined ? undefined : numberFor(row)
    if (line !== undefined) numbers.set(index, line)
  }
  return numbers
}

type Sign = { after: string; afterColor: string }

const BARE_SIGN: Sign = { after: "  ", afterColor: palette.accent }

const signFor = (entry: Display, rows: ReadonlyMap<number, Row>): Sign => {
  if (entry.comment || entry.prose) return BARE_SIGN
  const row = rows.get(entry.row)
  const sign = row === undefined ? undefined : SIGNS[row.kind]
  return sign === undefined ? BARE_SIGN : { after: sign.text, afterColor: sign.color }
}

const lineSigns = (patch: Patch, display: ReadonlyArray<Display>): Map<number, Sign> => {
  const rows = new Map(patch.rows.map((row) => [row.index, row]))
  return new Map(display.map((entry, index) => [index, signFor(entry, rows)]))
}

export const sideLineOf = (row: Row, side: "old" | "new"): number | undefined =>
  Option.getOrUndefined(lineOn(row, side))
