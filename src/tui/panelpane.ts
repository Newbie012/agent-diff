import { bg, fg, StyledText } from "@opentui/core"
import { marks, standMark } from "./marks.ts"
import { clipPath } from "./notespane.ts"
import {
  PANEL_SECTIONS,
  panelEntries,
  type PanelEntry,
  panelHolds,
  type PanelSection,
  threadStand,
} from "./panel.ts"
import type { Clicked, TuiState } from "./state.ts"
import { palette } from "./theme.ts"
import { clip } from "./words.ts"
import type { ReportedRemark } from "../review/index.ts"

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

export const restingOrHere = (focused: boolean): string =>
  focused ? palette.selection : palette.resting

export const REMARK_MARK = "◇"

const remarkWhere = (remark: ReportedRemark, known: boolean): string => {
  if (remark.placed) return `:${remark.end}`
  if (remark.outdated) return " · outdated"
  return known ? " · outside this diff" : " · not in the diff"
}

export const wherePart = (state: TuiState, entry: PanelEntry): string => {
  if (entry.kind === "fold") return ""
  if (entry.kind === "remark") {
    const known = state.patches.some((patch) => patch.path === entry.remark.file)
    return remarkWhere(entry.remark, known)
  }
  return entry.comment.outside === true ? " · not in the diff" : `:${entry.comment.end}`
}

export const panelFile = (entry: PanelEntry): string => {
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

export const lostCode = (entry: PanelEntry): ReadonlyArray<string> => {
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

export const panelText = (
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
