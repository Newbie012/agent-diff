import { Option } from "effect"

export type StagedComment = {
  readonly file: string
  readonly side: "old" | "new"
  readonly start: number
  readonly end: number
  readonly body: string
}
import type { Patch } from "../domain/patch/index.ts"
import { shownOf, type Reveal } from "./gaps.ts"
import { buildTree, crowdedDirectories, flattenTree, type Tree, type TreeRow } from "./tree.ts"
import type { BranchSummary, StoryStep } from "../cli/index.ts"

export type StepRow = {
  readonly index: number
  readonly kind: "title" | "note"
  readonly text: string
  readonly lead: boolean
}

export type Screen = "branches" | "review" | "compose" | "palette" | "pending" | "report"

export type TuiState = {
  readonly screen: Screen
  readonly branches: ReadonlyArray<BranchSummary>
  readonly branchIndex: number
  readonly patches: ReadonlyArray<Patch>
  readonly patchIndex: number
  readonly cursor: number
  readonly anchorRow: number
  readonly selecting: boolean
  readonly draft: string
  readonly notice: string
  readonly query: string
  readonly paletteIndex: number
  readonly returnTo: Screen
  readonly closed: ReadonlyArray<string>
  readonly vouched: ReadonlyArray<string>
  readonly staged: number
  readonly pending: ReadonlyArray<StagedComment>
  readonly sent: ReadonlyArray<StagedComment>
  readonly pendingIndex: number
  readonly viewport: number
  readonly context: number
  readonly top: number
  readonly source: ReadonlyArray<string>
  readonly full: ReadonlyArray<Patch>
  readonly revealed: ReadonlyArray<Reveal>
  readonly focus: "tree" | "diff"
  readonly navOpen: boolean
  readonly steps: ReadonlyArray<StoryStep>
  readonly stepIndex: number
  readonly openSteps: ReadonlyArray<number>
  readonly rail: "tree" | "steps"
}

export const initialState = (branches: ReadonlyArray<BranchSummary>): TuiState => ({
  screen: "branches",
  branches,
  branchIndex: 0,
  patches: [],
  patchIndex: 0,
  cursor: 0,
  anchorRow: 0,
  selecting: false,
  draft: "",
  notice: "",
  query: "",
  paletteIndex: 0,
  returnTo: "branches",
  closed: [],
  vouched: [],
  staged: 0,
  pending: [],
  sent: [],
  pendingIndex: 0,
  viewport: 20,
  context: 3,
  top: 0,
  source: [],
  full: [],
  revealed: [],
  focus: "diff",
  navOpen: true,
  steps: [],
  stepIndex: 0,
  openSteps: [],
  rail: "tree",
})

export const onSteps = (state: TuiState): boolean =>
  state.rail === "steps" && state.steps.length > 0

export const selectedStep = (state: TuiState): StoryStep | undefined => state.steps[state.stepIndex]

export const stepFiles = (state: TuiState, stepIndex: number): ReadonlyArray<number> => {
  const step = state.steps[stepIndex]
  if (step === undefined) return []
  return step.files.flatMap((path) => {
    const at = state.patches.findIndex((patch) => patch.path === path)
    return at === -1 ? [] : [at]
  })
}

export const stepHolding = (state: TuiState, fileIndex: number): number => {
  const path = state.patches[fileIndex]?.path
  const at = state.steps.findIndex((step) => step.files.includes(path ?? ""))
  return at === -1 ? state.stepIndex : at
}

export const stepOpen = (state: TuiState, stepIndex: number): boolean =>
  state.openSteps.includes(stepIndex)

const chunked = (word: string, room: number): ReadonlyArray<string> =>
  word.length <= room ? [word] : [word.slice(0, room), ...chunked(word.slice(room), room)]

const packed = (lines: ReadonlyArray<string>, word: string, room: number): ReadonlyArray<string> => {
  const last = lines.at(-1)
  if (last === undefined || last.length + 1 + word.length > room) return [...lines, word]
  return [...lines.slice(0, -1), `${last} ${word}`]
}

export const wrapped = (text: string, room: number): ReadonlyArray<string> => {
  const width = Math.max(1, room)
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .flatMap((word) => chunked(word, width))
    .reduce<ReadonlyArray<string>>((lines, word) => packed(lines, word, width), [])
}

export const NO_NOTE = "no note"

const noteRows = (state: TuiState, stepIndex: number, room: number): ReadonlyArray<StepRow> => {
  const lines = wrapped(state.steps[stepIndex]?.note ?? "", room)
  const shown = lines.length === 0 ? [NO_NOTE] : lines
  return shown.map((text) => ({ index: stepIndex, kind: "note" as const, text, lead: false }))
}

const titleRows = (state: TuiState, stepIndex: number, room: number): ReadonlyArray<StepRow> =>
  wrapped(state.steps[stepIndex]?.title ?? "", room).map((text, at) => ({
    index: stepIndex,
    kind: "title" as const,
    text,
    lead: at === 0,
  }))

export const stepRows = (
  state: TuiState,
  titleRoom: number,
  noteRoom: number,
): ReadonlyArray<StepRow> =>
  state.steps.flatMap((_, index) =>
    stepOpen(state, index)
      ? [...titleRows(state, index, titleRoom), ...noteRows(state, index, noteRoom)]
      : titleRows(state, index, titleRoom),
  )

export const railWindow = (
  rows: ReadonlyArray<StepRow>,
  height: number,
  stepIndex: number,
): { readonly rows: ReadonlyArray<StepRow>; readonly more: number } => {
  if (rows.length <= height) return { rows, more: 0 }
  const first = Math.max(0, rows.findIndex((row) => row.index === stepIndex))
  const block = rows.findLastIndex((row) => row.index === stepIndex) - first + 1
  const wanted = block >= height ? first : first - Math.floor((height - block) / 2)
  const start = Math.max(0, Math.min(rows.length - height, wanted))
  return { rows: rows.slice(start, start + height), more: rows.length - height }
}

export const selectedBranch = (state: TuiState): BranchSummary | undefined =>
  state.branches[state.branchIndex]

export const selectedPatch = (state: TuiState): Patch | undefined => shownOf(state)?.patch

export const treeOf = (state: TuiState): Tree =>
  buildTree(state.patches.map((patch) => patch.path))

export const CROWDED = 8

export const treeRows = (state: TuiState): ReadonlyArray<TreeRow> => {
  const tree = treeOf(state)
  return flattenTree(tree, state.closed)
}

export const crowdedOf = (patches: TuiState["patches"]): ReadonlyArray<string> =>
  crowdedDirectories(buildTree(patches.map((patch) => patch.path)), CROWDED)

export const directoryOfFile = (state: TuiState, fileIndex: number): string | undefined => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return undefined
  const segments = patch.path.split("/")
  return segments.length < 2 ? undefined : segments.slice(0, -1).join("/")
}

export const isReviewed = (state: TuiState, fileIndex: number): boolean => {
  const patch = state.patches[fileIndex]
  return patch !== undefined && state.vouched.includes(patch.path)
}

export const treeWindow = (
  state: TuiState,
  height: number,
): { readonly rows: ReadonlyArray<TreeRow>; readonly more: number } => {
  const rows = treeRows(state)
  if (rows.length <= height) return { rows, more: 0 }
  const here = rows.findIndex((row) => row.fileIndex === state.patchIndex)
  const anchor = here === -1 ? 0 : here
  const start = Math.max(0, Math.min(rows.length - height, anchor - Math.floor(height / 2)))
  return { rows: rows.slice(start, start + height), more: rows.length - height }
}

export const commentsOn = (state: TuiState, fileIndex: number): number => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return 0
  return state.pending.filter((entry) => entry.file === patch.path).length
}

export const hiddenLines = (state: TuiState): number =>
  shownOf(state)?.gaps.reduce((total, gap) => total + gap.hidden, 0) ?? 0

export const markedRows = (state: TuiState): ReadonlySet<number> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return new Set()
  const here = state.pending.filter((entry) => entry.file === patch.path)
  const rows = here.flatMap((entry) =>
    patch.rows
      .filter((row) =>
        Option.match(row.newLine, {
          onNone: () => false,
          onSome: (line) => line >= entry.start && line <= entry.end,
        }),
      )
      .map((row) => row.index),
  )
  return new Set(rows)
}

export const snippetOf = (state: TuiState, limit: number): ReadonlyArray<string> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const [from, to] = selectionRange(state)
  return patch.rows
    .slice(from, to + 1)
    .slice(0, limit)
    .map((row) => `${String(lineOf(row)).padStart(4)} ${row.text}`)
}

const lineOf = (row: Patch["rows"][number]): string =>
  Option.match(row.newLine, { onNone: () => "-", onSome: (line) => String(line) })

export const composeTarget = (state: TuiState): string => {
  const patch = selectedPatch(state)
  if (patch === undefined) return ""
  const [from, to] = selectionRange(state)
  const first = sourceLineAt(state, from) ?? from + 1
  const last = sourceLineAt(state, to) ?? to + 1
  const span = first === last ? `${first}` : `${first}-${last}`
  return `Comment on ${patch.path}:${span}`
}

export const selectionReadout = (state: TuiState): string => {
  const patch = selectedPatch(state)
  if (patch === undefined || !state.selecting) return ""
  const [from, to] = selectionRange(state)
  const lines = to - from + 1
  return `${patch.path}  ${lines} lines`
}

export const WHOLE_FILE = 100_000

export const CONTEXT_STEPS: ReadonlyArray<number> = [3, 10, 25, 60, WHOLE_FILE]

export const stepContext = (current: number, delta: number): number => {
  const at = CONTEXT_STEPS.indexOf(current)
  const next = Math.max(0, Math.min(CONTEXT_STEPS.length - 1, (at === -1 ? 0 : at) + delta))
  return CONTEXT_STEPS[next] ?? current
}

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

const lineOnSide = (row: Patch["rows"][number], side: "old" | "new"): number | undefined =>
  Option.getOrUndefined(side === "old" ? row.oldLine : row.newLine)

export const commentRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> => {
  const patch =
    fileIndex === state.patchIndex ? selectedPatch(state) : state.patches[fileIndex]
  if (patch === undefined) return []
  const notes = [...state.pending, ...state.sent].filter((entry) => entry.file === patch.path)
  const rows = patch.rows.filter((row) =>
    notes.some((note) => lineOnSide(row, note.side) === note.end),
  )
  return rows.map((row) => row.index).toSorted((left, right) => left - right)
}

export const filesWithComments = (state: TuiState): ReadonlyArray<number> =>
  state.patches.flatMap((patch, index) =>
    [...state.pending, ...state.sent].some((entry) => entry.file === patch.path) ? [index] : [],
  )

export const hunkStarts = (state: TuiState): ReadonlyArray<number> => {
  const patch = selectedPatch(state)
  return patch === undefined ? [] : patch.hunks.map((hunk) => hunk.startRow)
}

export const nextUnreviewed = (state: TuiState, from: number): number | undefined => {
  const order = fileOrder(state)
  const start = Math.max(0, order.indexOf(from))
  const rotated = [...order.slice(start + 1), ...order.slice(0, start + 1)]
  return rotated.find((index) => !isReviewed(state, index))
}

export const reviewedCount = (state: TuiState): string =>
  `${state.vouched.length}/${state.patches.length} reviewed`

export const countsOf = (state: TuiState, fileIndex: number): string => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return ""
  const total = patch.added + patch.removed
  return total === 0 ? "" : String(total)
}

export const fileOrder = (state: TuiState): ReadonlyArray<number> =>
  onSteps(state)
    ? stepFiles(state, state.stepIndex)
    : treeRows(state).flatMap((row) => (row.fileIndex === undefined ? [] : [row.fileIndex]))

export const stepFile = (state: TuiState, delta: number): number => {
  const order = fileOrder(state)
  const position = order.indexOf(state.patchIndex)
  if (position === -1) return order[0] ?? state.patchIndex
  const next = Math.max(0, Math.min(order.length - 1, position + delta))
  return order[next] ?? state.patchIndex
}

export const selectionRange = (state: TuiState): readonly [number, number] =>
  state.anchorRow <= state.cursor ? [state.anchorRow, state.cursor] : [state.cursor, state.anchorRow]
