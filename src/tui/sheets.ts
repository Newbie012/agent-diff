import { bg, bold, fg, StyledText, type TextChunk } from "@opentui/core"
import { type Command, displayKey, type Offered } from "./command.ts"
import { ANSWER_MARK, REPLY_MARK } from "./diffview.ts"
import { reviewedCountIn } from "./files.ts"
import { marks, type MarkSet } from "./marks.ts"
import { askedRows, cursorOnThread, threadHere } from "./notes.ts"
import { standingOnDismissed, standingOnRemark } from "./notespane.ts"
import { panelEntry, type PanelEntry } from "./panel.ts"
import { lostCode, panelFile, REMARK_MARK, wherePart } from "./panelpane.ts"
import {
  authorHere,
  heldWhere,
  onLayers,
  type PreferenceRow,
  pullHere,
  selectedBranch,
  type StagedComment,
  type TuiState,
  theirPull,
} from "./state.ts"
import { palette } from "./theme.ts"
import { LIST_LEAD } from "./chrome.ts"
import { clip, counted, wrapped } from "./words.ts"
import { askedThreads } from "./notes.ts"

const PALETTE_KEY = 11

const PALETTE_GAP = 2

export const MODAL_CHROME = 8

export const PLAIN_CHROME = 6

export const SHEET_CHROME = 6

export type Titled = { readonly title: string; readonly count: string }

export const titleText = (titled: Titled, room: number): StyledText => {
  const spent = titled.count.length === 0 ? 0 : titled.count.length + PALETTE_GAP
  const shown = clip(titled.title, Math.max(1, room - spent))
  const gap = Math.max(0, room - shown.length - titled.count.length)
  return new StyledText([
    bold(fg(palette.accent)(shown)),
    fg(palette.muted)(`${" ".repeat(gap)}${titled.count}`),
  ])
}

export const LEGEND_ROWS = 1

const LEGEND: ReadonlyArray<readonly [keyof MarkSet, string]> = [
  ["filed", "written"],
  ["waiting", "picked up"],
  ["answered", "answered"],
  ["asked", "waiting on you"],
  ["done", "settled"],
]

export const legendText = (room: number): string => {
  const said = LEGEND.map(([key, means]) => `${marks()[key]} ${means}`)
  const voices = [`${REMARK_MARK} remark`, `${REPLY_MARK} you`, `${ANSWER_MARK} the agent`]
  return clip([...said, ...voices].join("   "), room)
}

export const keysTitle = (found: number, whole: boolean): Titled => {
  if (found === 0) return { title: "No key matches", count: "" }
  return { title: "Keys", count: whole ? `${found}` : `${found}, arrows for the rest` }
}

const keysOf = (entry: Command): string =>
  entry.keys.map((one) => displayKey(one)).join(" ")

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

export const listText = (
  rows: ReadonlyArray<string>,
  at: number,
  height: number,
  wide: number,
): StyledText => {
  const shown = windowed(rows, at, Math.max(1, height))
  const drawn = shown.rows.map((row, index) => {
    const here = shown.from + index === at
    const text = `${here ? marks().cursor : " "} ${row}`.padEnd(wide)
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
  if (row.heading) return bold(fg(palette.muted)(text))
  return here ? bg(palette.selection)(fg(palette.ink)(text)) : fg(palette.ink)(text)
}

const paletteBlocks = (rows: ReadonlyArray<Command>, room: number): ReadonlyArray<SheetRow> => {
  const categories = [...new Set(rows.map((entry) => entry.category))]
  const blocks = categories.map((category) =>
    sheetBlock(
      rows,
      rows.flatMap((entry, at) => (entry.category === category ? [at] : [])),
      room,
    ),
  )
  return blocks.flat().slice(0, -1)
}

const windowTop = (listed: ReadonlyArray<SheetRow>, on: number, height: number): number => {
  const centred = Math.max(0, Math.min(listed.length - height, on - Math.floor(height / 2)))
  const withHeading = centred > 0 && listed[centred - 1]?.heading === true ? centred - 1 : centred
  const keepsCursor = on < 0 || (on >= withHeading && on < withHeading + height)
  return keepsCursor ? withHeading : centred
}

export const paletteDeep = (rows: ReadonlyArray<Command>, room: number): number =>
  paletteBlocks(rows, room - LIST_LEAD).length

export const paletteText = (
  rows: ReadonlyArray<Command>,
  at: number,
  shown: { readonly height: number; readonly room: number },
): StyledText => {
  const listed = paletteBlocks(rows, shown.room - LIST_LEAD)
  const on = listed.findIndex((row) => row.at === at)
  const top = windowTop(listed, on, shown.height)
  const drawn = listed
    .slice(top, top + shown.height)
    .flatMap((row) => [sheetPaint(row, row.at === at, shown.room), fg(palette.ink)("\n")])
  return new StyledText(drawn)
}

export const sheetDeep = (rows: ReadonlyArray<Command>, room: number): number => {
  const column = Math.max(12, Math.floor((room - SHEET_GAP) / 2))
  const { left, right } = splitInTwo(
    groupedBy(rows).map((group) => sheetBlock(rows, group, column - 2)),
  )
  return Math.max(left.length, right.length)
}

export const sheetText = (
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

type NoteRow = {
  readonly text: string
  readonly note: number
  readonly tone: "heading" | "code" | "body" | "gap"
}

const REWRITTEN_TAIL = " · rewritten by the agent"

const NOTHING_HELD = "Before you send — nothing held for the author"

export const sendingTitle = (state: TuiState): string => {
  const many = state.held.length
  if (many === 0) return NOTHING_HELD
  return `Before you send — ${counted(many, "note")} to @${authorHere(state)}'s pull request`
}

const noteBlock = (note: StagedComment, at: number, room: number): ReadonlyArray<NoteRow> => {
  const tail = note.rewritten === true ? REWRITTEN_TAIL : ""
  const code = (note.snippet ?? "").split("\n").filter((line) => line.trim().length > 0)
  return [
    { text: clip(`${heldWhere(note)}${tail}`, room), note: at, tone: "heading" },
    ...code.map((line): NoteRow => ({ text: clip(`│ ${line}`, room), note: at, tone: "code" })),
    ...note.body
      .split("\n")
      .flatMap((line) => wrapped(line, room))
      .map((text): NoteRow => ({ text, note: at, tone: "body" })),
    { text: "", note: at, tone: "gap" },
  ]
}

const sendingRows = (state: TuiState, room: number): ReadonlyArray<NoteRow> =>
  state.held.flatMap((note, at) => noteBlock(note, at, room))

const sendingTop = (rows: ReadonlyArray<NoteRow>, at: number, height: number): number => {
  const first = rows.findIndex((row) => row.note === at)
  const last = rows.findLastIndex((row) => row.note === at)
  const wanted = Math.max(0, Math.min(first, last - height + 1))
  return Math.max(0, Math.min(rows.length - height, wanted))
}

const TONES: Readonly<Record<NoteRow["tone"], string>> = {
  heading: palette.accent,
  code: palette.faint,
  body: palette.ink,
  gap: palette.ink,
}

const notePaint = (row: NoteRow, here: boolean, room: number): TextChunk => {
  const mark = here ? marks().cursor : " "
  const text = `${mark} ${row.text}`.padEnd(room)
  return here ? bg(palette.selection)(fg(palette.ink)(`${text}\n`)) : fg(TONES[row.tone])(`${text}\n`)
}

export const sendingText = (
  state: TuiState,
  shown: { readonly height: number; readonly room: number },
): StyledText => {
  const rows = sendingRows(state, Math.max(1, shown.room - LIST_LEAD))
  const top = sendingTop(rows, state.sendIndex, shown.height)
  const drawn = rows
    .slice(top, top + shown.height)
    .map((row) => notePaint(row, row.tone === "heading" && row.note === state.sendIndex, shown.room))
  return new StyledText(drawn)
}

export const askText = (state: TuiState, room: number): StyledText => {
  const listed = askedThreads(state).map((line) =>
    fg(palette.faint)(`${clip(`  ${line}`, room).padEnd(room)}\n`),
  )
  const drawn = askedRows(state).map((row) => {
    const head = `${row.here ? marks().cursor : " "} ${row.title}`
    return row.here
      ? bg(palette.selection)(fg(palette.ink)(`${head.padEnd(room)}\n`))
      : fg(palette.muted)(`${head.padEnd(room)}\n`)
  })
  return new StyledText([...listed, ...drawn])
}

const SETTING_TITLE = 36

export const SETTING_TAIL = 2

export const settingsText = (rows: ReadonlyArray<PreferenceRow>, room: number): StyledText => {
  const drawn = rows.flatMap((row) => {
    const head = `${row.here ? marks().cursor : " "} ${clip(row.title, SETTING_TITLE - PALETTE_GAP).padEnd(SETTING_TITLE)}`
    const state = clip(row.said, Math.max(1, room - head.length)).padEnd(Math.max(0, room - head.length))
    if (row.here) return [bg(palette.selection)(fg(palette.ink)(`${head}${state}\n`))]
    return [fg(palette.ink)(head), fg(row.on ? palette.added : palette.muted)(`${state}\n`)]
  })
  const here = rows.find((row) => row.here)
  const about =
    here === undefined
      ? []
      : [fg(palette.ink)("\n"), fg(palette.faint)(`${`  ${clip(here.about, Math.max(8, room - 2))}`.padEnd(room)}\n`)]
  return new StyledText([...drawn, ...about])
}

export const offeredIn = (state: TuiState): Offered => ({
  comments: state.sent.length,
  held: state.held.length,
  layers: state.layers.length,
  onThread: cursorOnThread(state) && !onHeldEntry(state),
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
  onHeld: onHeldEntry(state),
  theirs: theirPull(state),
  rewording: state.editing !== undefined,
})

const onHeldEntry = (state: TuiState): boolean =>
  state.screen === "sending" || (state.focus === "review" && panelEntry(state)?.section === "held")

export const readerTitle = (state: TuiState, entry: PanelEntry): string => {
  if (entry.kind === "fold") return "The branch moved past these"
  const where = wherePart(state, entry).replace(" · ", "").trim()
  return where.length === 0 ? "This thread" : `This thread · ${where}`
}

export const voicesOf = (entry: PanelEntry): ReadonlyArray<string> => {
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

export const readerText = (entry: PanelEntry, room: number): StyledText => {
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

export const pickingTitle = (state: TuiState): { readonly title: string; readonly sub: string } => {
  if (state.screen === "editor") {
    return {
      title: "Editor",
      sub: state.editorNow.length === 0 ? "none found" : `now ${state.editorNow}`,
    }
  }
  const here = selectedBranch(state)
  const on = here === undefined ? "" : `${here.base}${here.basis === "set" ? "" : ", adiff's guess"}`
  return {
    title: "Base",
    sub: `for ${here?.branch ?? "this branch"}${on.length === 0 ? "" : ` · now ${on}`}`,
  }
}

const YOURS = "   ← the command you typed"

const YOUR_REF = "   ← the ref you typed"

export const pickedTail = (state: TuiState, ref: string, typed: string): string => {
  if (typed.length === 0 || ref !== typed || state.refs.includes(ref)) return ""
  return state.screen === "editor" ? YOURS : YOUR_REF
}
