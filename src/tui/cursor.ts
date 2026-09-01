import { Option } from "effect"
import type { Patch } from "../domain/patch/index.ts"
import type { Match } from "../review/index.ts"
import { gapRowSet, shownOf } from "./gaps.ts"
import { selectedPatch, type StagedComment, type TuiState } from "./state.ts"

export const hiddenLines = (state: TuiState): number =>
  shownOf(state)?.gaps.reduce((total, gap) => total + gap.hidden, 0) ?? 0

export const rowsUnder = (patch: Patch, entry: StagedComment): ReadonlyArray<number> =>
  patch.rows
    .filter((row) =>
      Option.match(row.newLine, {
        onNone: () => false,
        onSome: (line) => line >= entry.start && line <= entry.end,
      }),
    )
    .map((row) => row.index)

export const carriesLine = (row: Patch["rows"][number]): boolean =>
  Option.isSome(row.newLine) || Option.isSome(row.oldLine)

export const selectedRows = (state: TuiState): ReadonlyArray<Patch["rows"][number]> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const [from, to] = selectionRange(state)
  return patch.rows.slice(from, to + 1).filter(carriesLine)
}

export const selectedLineCount = (state: TuiState): number => selectedRows(state).length

export const lineOf = (row: Patch["rows"][number]): string =>
  Option.match(row.newLine, { onNone: () => "-", onSome: (line) => String(line) })

export const pickedText = (state: TuiState): string | undefined => {
  const picked = state.picked
  const patch = selectedPatch(state)
  if (picked === undefined || patch === undefined) return undefined
  const text = patch.rows[picked.row]?.text
  if (text === undefined) return undefined
  const taken = text.slice(picked.from, picked.to)
  return taken.length === 0 ? undefined : taken
}

const takenRows = (state: TuiState): ReadonlyArray<Patch["rows"][number]> => {
  const shown = shownOf(state)
  if (shown === undefined) return []
  const [from, to] = selectionRange(state)
  const gaps = gapRowSet(shown)
  const rows = shown.patch.rows.slice(from, to + 1).filter((row) => !gaps.has(row.index))
  const onlyGone = rows.length > 0 && rows.every((row) => row.kind === "removed")
  return onlyGone ? rows : rows.filter((row) => row.kind !== "removed")
}

export const selectedLines = (state: TuiState): ReadonlyArray<string> =>
  takenRows(state).map((row) => row.text)

export const shownMatches = (state: TuiState): ReadonlyArray<Match> => {
  const wanted = state.query.trim().toLowerCase()
  if (wanted.length === 0) return state.matches
  return state.matches.filter((match) =>
    `${match.path}:${match.line} ${match.text}`.toLowerCase().includes(wanted),
  )
}

export const refNoteOf = (state: TuiState, ref: string): string => state.refSaid[ref] ?? ""

export const refsShown = (state: TuiState): ReadonlyArray<string> => {
  const wanted = state.query.trim().toLowerCase()
  const held = state.refs.filter((ref) =>
    `${ref} ${refNoteOf(state, ref)}`.toLowerCase().includes(wanted),
  )
  return wanted.length === 0 || held.some((ref) => ref.toLowerCase() === wanted)
    ? held
    : held.concat([state.query.trim()])
}

export const isPicking = (state: TuiState): boolean =>
  state.screen === "base" || state.screen === "editor"

export const refHere = (state: TuiState): string | undefined =>
  refsShown(state)[state.refIndex]

export const matchHere = (state: TuiState): Match | undefined =>
  shownMatches(state)[state.matchIndex]

export const newLineAt = (state: TuiState, row: number): number | undefined => {
  const rows = selectedPatch(state)?.rows ?? []
  const ahead = rows.slice(row).find((candidate) => Option.isSome(candidate.newLine))
  if (ahead !== undefined) return Option.getOrUndefined(ahead.newLine)
  const behind = rows.slice(0, row).findLast((candidate) => Option.isSome(candidate.newLine))
  return behind === undefined ? undefined : Option.getOrUndefined(behind.newLine)
}

export const sourceLineAt = (state: TuiState, row: number): number | undefined => {
  const patch = selectedPatch(state)
  const found = patch?.rows[row]
  if (found === undefined) return undefined
  return Option.getOrUndefined(found.newLine) ?? Option.getOrUndefined(found.oldLine)
}

export const rowAtSourceLine = (patch: Patch, line: number): number => {
  const found = patch.rows.find((row) =>
    Option.match(row.newLine, { onNone: () => false, onSome: (value) => value >= line }),
  )
  return found?.index ?? 0
}

export const rowShowing = (patch: Patch, line: number): number | undefined =>
  patch.rows.find((row) =>
    Option.match(row.newLine, { onNone: () => false, onSome: (value) => value === line }),
  )?.index

export const lineOnSide = (row: Patch["rows"][number], side: "old" | "new"): number | undefined =>
  Option.getOrUndefined(side === "old" ? row.oldLine : row.newLine)

export const selectionRange = (state: TuiState): readonly [number, number] =>
  state.anchorRow <= state.cursor ? [state.anchorRow, state.cursor] : [state.cursor, state.anchorRow]
