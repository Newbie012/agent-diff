import type { StyledText} from "@opentui/core";
import { fg, t } from "@opentui/core"
import { composeRoom as composeText } from "./layout.ts"
import { selectedLineCount } from "./cursor.ts"
import type { Note } from "./diffview.ts"
import { composeBox } from "./layout.ts"
import {
  remarkQuote,
  remarkShown,
  remarkHere,
  remarkUnderCursor,
  snippetOf,
  threadQuote,
} from "./notes.ts"
import type { StagedComment, TuiState } from "./state.ts"
import { palette } from "./theme.ts"
import { clip, wrapped } from "./words.ts"

export const COMPOSE_CHROME = 3

export const DRAFT_PAD = 2

export const NOTE_ROOM_MIN = 24

export const DRAFT_ROOM = 6

export const DRAFT_HEAD = 1

export const COMPOSE_ACTION_ROWS = 2

export const reportActions = (full: boolean): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^t")} ${fg(palette.muted)(full ? "sending everything" : "sending the least")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)("copy and save")}`

export const SENDS = "send it"

export const REPLIES = "reply on the pull request"

export const actionsText = (said: string): StyledText =>
  t`${fg(palette.accent)("esc")} ${fg(palette.muted)("cancel")}     ${fg(palette.accent)("^s")} ${fg(palette.muted)(said)}`

export const SNIPPET_LINES = 4

type ComposeRoom = { readonly box: number; readonly text: number }

export const composeRoom = (width: number): ComposeRoom => ({
  box: composeBox(width),
  text: composeText(width),
})

export const laidOut = (lines: ReadonlyArray<string>, room: number): ReadonlyArray<string> =>
  lines.flatMap((line) => {
    const parts = wrapped(line, room)
    return parts.length === 0 ? [""] : parts
  })

const stillThere = (sent: TuiState["sent"]): TuiState["sent"] =>
  sent.filter((one) => one.removed !== true)

export const quotedFor = (state: TuiState, shownLines: number, room: number): ReadonlyArray<string> => {
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

export const clipHead = (label: string, room: number): string =>
  label.length > room ? `…${label.slice(label.length - Math.max(0, room - 1))}` : label

export const clipMiddle = (label: string, room: number): string => {
  if (label.length <= room) return label
  const kept = Math.max(0, room - 1)
  const front = Math.floor(kept / 2)
  return `${label.slice(0, front)}…${label.slice(label.length - (kept - front))}`
}

export const clipPath = (label: string, room: number): string => {
  if (label.length <= room) return label
  const segments = label.split("/")
  const kept = segments.reduce<Array<string>>((tail, _, index) => {
    const candidate = segments.slice(segments.length - index - 1)
    return `…/${candidate.join("/")}`.length <= room ? candidate : tail
  }, [])
  return kept.length === 0 ? clipHead(label, room) : `…/${kept.join("/")}`
}

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

export const notesFor = (state: TuiState, path: string): ReadonlyArray<Note> => [
  ...notesOf(stillThere(state.sent), path, true, { opened: state.opened, now: state.now }),
  ...notesOf(state.held, path, false, { opened: state.opened, now: state.now }),
  ...remarksOf(state, path),
]

export const standingOnRemark = (state: TuiState): boolean => remarkHere(state) !== undefined

export const standingOnDismissed = (state: TuiState): boolean =>
  remarkUnderCursor(state)?.dismissed === true
