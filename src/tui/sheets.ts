import { bg, fg, StyledText, type TextChunk } from "@opentui/core"
import { type Command, displayKey, type Offered } from "./command.ts"
import { ANSWER_MARK, REPLY_MARK } from "./diffview.ts"
import { reviewedCountIn } from "./files.ts"
import { marks, type MarkSet } from "./marks.ts"
import { askedRows, cursorOnThread, threadHere } from "./notes.ts"
import { standingOnDismissed, standingOnRemark } from "./notespane.ts"
import { panelEntry, type PanelEntry } from "./panel.ts"
import { lostCode, panelFile, REMARK_MARK, wherePart } from "./panelpane.ts"
import { onLayers, type PreferenceRow, pullHere, selectedBranch, type TuiState } from "./state.ts"
import { palette } from "./theme.ts"
import { clip, wrapped } from "./words.ts"
import { askedThreads } from "./notes.ts"

const PALETTE_KEY = 11

const PALETTE_TITLE = 60

const PALETTE_GAP = 2

export const PALETTE_CHROME = 4

export const PENDING_CHROME = 4

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

export const keysTitle = (found: number, whole: boolean): string => {
  if (found === 0) return "No key matches"
  return whole ? `Keys here, ${found} of them` : `Keys here, ${found} of them — arrows for the rest`
}

const keysOf = (entry: Command): string =>
  entry.keys.map((one) => displayKey(one)).join(" ")

export const commandRow = (entry: Command, room: number): string => {
  const key = clip(keysOf(entry), PALETTE_KEY - PALETTE_GAP).padEnd(PALETTE_KEY)
  const left = Math.max(1, Math.min(PALETTE_TITLE, room - PALETTE_KEY - entry.category.length - PALETTE_GAP))
  return `${key}${clip(entry.title, left - PALETTE_GAP).padEnd(left)}${entry.category}`
}

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

export const listText = (
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

const SETTING_LEAD = 4

export const settingsText = (rows: ReadonlyArray<PreferenceRow>, room: number): StyledText => {
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

export const offeredIn = (state: TuiState): Offered => ({
  comments: state.sent.length,
  held: state.held.length,
  layers: state.layers.length,
  onThread: cursorOnThread(state),
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

export const pickingTitle = (state: TuiState): string => {
  if (state.screen === "editor") {
    return `Editor${state.editorNow.length === 0 ? " — none found" : ` — now ${state.editorNow}`}`
  }
  const here = selectedBranch(state)
  const on = here === undefined ? "" : `${here.base}${here.basis === "set" ? "" : ", adiff's guess"}`
  return `Base for ${here?.branch ?? "this branch"}${on.length === 0 ? "" : ` — now ${on}`}`
}

const YOURS = "   ← the command you typed"

const YOUR_REF = "   ← the ref you typed"

export const pickedTail = (state: TuiState, ref: string, typed: string): string => {
  if (typed.length === 0 || ref !== typed || state.refs.includes(ref)) return ""
  return state.screen === "editor" ? YOURS : YOUR_REF
}
