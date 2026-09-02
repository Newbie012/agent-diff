import type { ThreadStand } from "./marks.ts"
import type { StagedComment, TuiState } from "./state.ts"
import type { ReportedRemark } from "../review/index.ts"

export type PanelSection =
  | "remarks"
  | "held"
  | "asked"
  | "filed"
  | "with"
  | "answered"
  | "movedOn"
  | "settled"
  | "removed"
  | "dismissed"

export const PANEL_SECTIONS: ReadonlyArray<PanelSection> = [
  "remarks",
  "held",
  "asked",
  "filed",
  "with",
  "answered",
  "movedOn",
  "settled",
  "removed",
  "dismissed",
]

export type PanelEntry =
  | {
      readonly kind: "comment"
      readonly section: PanelSection
      readonly comment: StagedComment
      readonly fresh: boolean
      readonly unread: number
    }
  | {
      readonly kind: "remark"
      readonly section: PanelSection
      readonly remark: ReportedRemark
    }
  | {
      readonly kind: "fold"
      readonly section: PanelSection
      readonly held: number
      readonly open: boolean
    }

export const answersIn = (comment: StagedComment): number => comment.answers?.length ?? 0

const newerOf = (state: TuiState, comment: StagedComment): StagedComment => {
  if (comment.id === undefined) return comment
  const later = state.arrived.find((entry) => entry.id === comment.id)
  if (later === undefined) return comment
  return answersIn(later) > answersIn(comment) ? later : comment
}

export const lastVoice = (comment: StagedComment): "reviewer" | "agent" | undefined =>
  comment.turns?.at(-1)?.voice

const SECTION_OF: Readonly<Record<ThreadStand, PanelSection>> = {
  filed: "filed",
  gone: "removed",
  settled: "settled",
  asked: "asked",
  answered: "answered",
  waiting: "with",
}

export const outsideOpen = (comment: StagedComment): boolean =>
  comment.outside === true && comment.settled !== true && comment.removed !== true

const sectionOf = (comment: StagedComment): PanelSection =>
  outsideOpen(comment) ? "movedOn" : SECTION_OF[threadStand(comment)]

const sentEntry = (state: TuiState, comment: StagedComment): PanelEntry => {
  const newer = newerOf(state, comment)
  return {
    kind: "comment",
    section: sectionOf(newer),
    comment: newer,
    fresh: newer !== comment,
    unread: newer.unread ?? 0,
  }
}

const remarkRows = (state: TuiState, section: "remarks" | "dismissed"): ReadonlyArray<PanelEntry> =>
  state.remarks
    .filter((one) => (section === "remarks" ? one.state === "waiting" : one.state === "dismissed"))
    .map((remark): PanelEntry => ({ kind: "remark", section, remark }))

export const panelHolds = (state: TuiState): ReadonlyArray<PanelEntry> =>
  panelEntries({ ...state, openMoved: true }).filter((entry) => entry.kind !== "fold")

export const panelEntries = (state: TuiState): ReadonlyArray<PanelEntry> => {
  const shown = state.hideSettled
    ? state.sent.filter((comment) => comment.settled !== true)
    : state.sent
  const waiting = state.held.map(
    (comment): PanelEntry => ({
      kind: "comment",
      section: "held",
      comment,
      fresh: false,
      unread: 0,
    }),
  )
  const delivered = [
    ...remarkRows(state, "remarks"),
    ...waiting,
    ...shown.map((comment) => sentEntry(state, comment)),
    ...remarkRows(state, "dismissed"),
  ]
  const ordered = (section: PanelSection): ReadonlyArray<PanelEntry> => {
    const found = delivered.filter((entry) => entry.section === section)
    const held = state.newestFirst ? found.toReversed() : found
    if (section !== "movedOn" || held.length === 0) return held
    const fold: PanelEntry = {
      kind: "fold",
      section,
      held: held.length,
      open: state.openMoved,
    }
    return state.openMoved ? [fold, ...held] : [fold]
  }
  return PANEL_SECTIONS.flatMap((section) => ordered(section))
}

export const panelEntry = (state: TuiState): PanelEntry | undefined =>
  panelEntries(state)[state.panelIndex]

export const threadChosen = (state: TuiState): StagedComment | undefined => {
  if (state.focus !== "review") return undefined
  const entry = panelEntry(state)
  return entry?.kind === "comment" ? entry.comment : undefined
}

export const remarkChosen = (state: TuiState): ReportedRemark | undefined => {
  if (state.focus !== "review") return undefined
  const entry = panelEntry(state)
  return entry?.kind === "remark" ? entry.remark : undefined
}

export const MINUTE = 60_000

export const HOUR = 60 * MINUTE

export const DAY = 24 * HOUR

export const agoText = (at: string, now = Date.now()): string => {
  const gap = now - Date.parse(at)
  if (!Number.isFinite(gap) || gap < MINUTE) return "just now"
  if (gap < HOUR) return `${Math.floor(gap / MINUTE)}m ago`
  if (gap < DAY) return `${Math.floor(gap / HOUR)}h ago`
  return `${Math.floor(gap / DAY)}d ago`
}

export const threadStand = (thread: StagedComment): ThreadStand => {
  if (thread.removed === true) return "gone"
  if (thread.settled === true) return "settled"
  if (thread.asks === true) return "asked"
  if (lastVoice(thread) === "agent" && answersIn(thread) > 0) return "answered"
  return thread.takenAt === undefined ? "filed" : "waiting"
}

export const STAND_WEIGHT: Readonly<Record<ThreadStand, number>> = {
  gone: 0,
  settled: 1,
  filed: 2,
  waiting: 2,
  answered: 3,
  asked: 4,
}

export const louderOf = (one: ThreadStand, other: ThreadStand): ThreadStand =>
  STAND_WEIGHT[one] > STAND_WEIGHT[other] ? one : other
