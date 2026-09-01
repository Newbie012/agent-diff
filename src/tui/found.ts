import { bg, fg, type TextChunk } from "@opentui/core"
import type { Match } from "../review/index.ts"
import { marks } from "./marks.ts"
import { clipHead } from "./notespane.ts"
import type { TuiState } from "./state.ts"
import { palette } from "./theme.ts"
import { clip } from "./words.ts"

export const FOUND_LEAST = 6

export const nothingYet = (state: TuiState, room: number): string => {
  const wanted = state.query.trim()
  if (wanted.length === 0 || state.term.length === 0) return "".padEnd(room)
  return clip(` nothing uses ${wanted}`, room).padEnd(room)
}

const counting = (many: number): string => many.toLocaleString("en-US")

export const foundBlocks = (
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

export const foundTitle = (state: TuiState, room: number): string => {
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

export const windowedBlocks = (
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
