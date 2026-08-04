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
import { palette, syntaxTheme } from "./theme.ts"

export type LinePaint = { readonly gutter: RGBA; readonly content: RGBA }

export type Note = {
  readonly side: "old" | "new"
  readonly line: number
  readonly body: string
  readonly sent: boolean
}

type Display = {
  readonly text: string
  readonly row: number
  readonly comment: boolean
  readonly sent: boolean
  readonly label: boolean
}

const WASH: Partial<Record<RowKind, LinePaint>> = {
  added: { gutter: RGBA.fromHex(palette.addedGutter), content: RGBA.fromHex(palette.addedBg) },
  removed: {
    gutter: RGBA.fromHex(palette.removedGutter),
    content: RGBA.fromHex(palette.removedBg),
  },
}

const NOTE_MIN = 24
const SIGN_WIDTH = 2
const SCROLL_ROWS = 3

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
  private shown: Patch | undefined
  private noted = ""
  private display: ReadonlyArray<Display> = []
  private starts = new Map<number, number>()
  private fitted = 1

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

  private noteRoom(): number {
    return Math.max(NOTE_MIN, this.code.width - this.gutterWidth() - 3)
  }

  gutterWidth(): number {
    return Math.max(0, this.code.x - this.numbers.x) + SIGN_WIDTH
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
    readonly down: (y: number) => void
    readonly drag: (y: number) => void
    readonly dragEnd: (y: number) => void
  }): void {
    this.numbers.onMouseScroll = (event: { scroll?: { direction?: string; delta?: number } }) => {
      const notches = Math.max(1, event.scroll?.delta ?? 1)
      const size = notches * SCROLL_ROWS
      handlers.scroll(event.scroll?.direction === "up" ? -size : size)
    }
    this.numbers.onMouseDown = (event: { y: number }) => handlers.down(event.y)
    this.numbers.onMouseDrag = (event: { y: number }) => handlers.drag(event.y)
    this.numbers.onMouseDragEnd = (event: { y: number }) => handlers.dragEnd(event.y)
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
      this.shown = undefined
    }
  }

  rows(): number {
    return this.fitted
  }

  show(patch: Patch, notes: ReadonlyArray<Note>): void {
    const room = this.noteRoom()
    const key = [room, ...notes.map((note) => `${note.side}${note.line}:${note.body}`)].join("\u0000")
    if (patch === this.shown && key === this.noted) return
    this.pinnedText = ""
    this.shown = patch
    this.noted = key
    this.display = layout(patch, notes, room)
    this.starts = new Map()
    for (const [index, entry] of this.display.entries()) {
      if (!entry.comment && !this.starts.has(entry.row)) this.starts.set(entry.row, index)
    }
    this.code.filetype = pathToFiletype(patch.path) ?? "text"
    this.code.content = this.display.map((entry) => entry.text).join("\n")
    this.numbers.setLineNumbers(lineNumbers(patch, this.display))
    this.numbers.setHideLineNumbers(
      new Set(this.display.flatMap((entry, index) => (entry.comment ? [index] : []))),
    )
    this.numbers.setLineSigns(lineSigns(patch, this.display))
    this.numbers.setLineColors(new Map())
    const spans = noteSpans(this.display)
    this.code.onHighlight = (highlights) => [
      ...highlights.filter((highlight) => !spans.some(([from, to]) => highlight[0] < to && highlight[1] > from)),
      ...spans,
    ]
  }

  rowAt(display: number): number {
    const at = Math.max(0, Math.min(this.display.length - 1, display))
    return this.display[at]?.row ?? 0
  }

  isComment(display: number): boolean {
    return this.display[display]?.comment === true
  }

  scrollTo(row: number, cursor: number): number {
    const highest = Math.max(0, this.display.length - this.rows())
    const wanted = this.starts.get(row) ?? row
    const at = this.starts.get(cursor)
    const expected = cursor >= row && cursor < row + this.rows()
    const kept = expected && at !== undefined ? Math.max(wanted, at - this.rows() + 1) : wanted
    const clamped = Math.max(0, Math.min(highest, kept))
    if (this.code.scrollY !== clamped) this.code.scrollY = clamped
    return clamped
  }

  paint(paints: ReadonlyMap<number, LinePaint>): void {
    const colors = new Map<number, LinePaint>()
    for (const [index, entry] of this.display.entries()) {
      const paint = entry.comment ? NOTE_PAINT : paints.get(entry.row)
      if (paint !== undefined) colors.set(index, paint)
    }
    this.numbers.setLineColors(colors)
  }

  washOf(kind: RowKind): LinePaint | undefined {
    return WASH[kind]
  }
}

const noteSpans = (display: ReadonlyArray<Display>): ReadonlyArray<[number, number, string]> => {
  const spans: Array<[number, number, string]> = []
  let at = 0
  for (const entry of display) {
    if (entry.comment) {
      const group = entry.label ? "note.label" : entry.sent ? "note.sent" : "note"
      spans.push([at, at + entry.text.length, group])
    }
    at += entry.text.length + 1
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

const noteLines = (note: Note, room: number): ReadonlyArray<string> => [
  note.sent ? `${marks().sent} sent` : `${marks().staged} staged`,
  ...note.body.split("\n").flatMap((line) => wrap(line, room)),
]

const noteRows = (note: Note, row: number, room: number): ReadonlyArray<Display> =>
  noteLines(note, room).map((line, index) => ({
    text: `${marks().rule} ${line}`,
    row,
    comment: true,
    sent: note.sent,
    label: index === 0,
  }))

const layout = (
  patch: Patch,
  notes: ReadonlyArray<Note>,
  room: number,
): ReadonlyArray<Display> => {
  const display: Array<Display> = []
  for (const row of patch.rows) {
    display.push({ text: row.text, row: row.index, comment: false, sent: false, label: false })
    for (const note of notes) {
      if (sideLineOf(row, note.side) === note.line) {
        display.push(...noteRows(note, row.index, room))
      }
    }
  }
  return display
}

const lineNumbers = (patch: Patch, display: ReadonlyArray<Display>): Map<number, number> => {
  const numbers = new Map<number, number>()
  const rows = new Map(patch.rows.map((row) => [row.index, row]))
  for (const [index, entry] of display.entries()) {
    const row = entry.comment ? undefined : rows.get(entry.row)
    const line = row === undefined ? undefined : numberFor(row)
    if (line !== undefined) numbers.set(index, line)
  }
  return numbers
}

const lineSigns = (
  patch: Patch,
  display: ReadonlyArray<Display>,
): Map<number, { after: string; afterColor: string }> => {
  const signs = new Map<number, { after: string; afterColor: string }>()
  const rows = new Map(patch.rows.map((row) => [row.index, row]))
  for (const [index, entry] of display.entries()) {
    const row = rows.get(entry.row)
    const sign = entry.comment || row === undefined ? undefined : SIGNS[row.kind]
    signs.set(index, {
      after: sign?.text ?? "  ",
      afterColor: sign?.color ?? palette.accent,
    })
  }
  return signs
}

export const sideLineOf = (row: Row, side: "old" | "new"): number | undefined =>
  Option.getOrUndefined(lineOn(row, side))
