import { Option } from "effect"
import type { Remark } from "../review/index.ts"
import type { ThreadStand } from "./marks.ts"
import type { ReportedLayer } from "../review/index.ts"
import { anchorFor } from "../domain/patch/index.ts"
import { lineOf, lineOnSide, rowsUnder, selectedRows, selectionRange } from "./cursor.ts"
import { readIn } from "./files.ts"
import { louderOf, panelEntry, threadChosen, threadStand } from "./panel.ts"
import { type Asking, selectedPatch, type StagedComment, type TuiState } from "./state.ts"
import { counted, wrapped } from "./words.ts"

export type OpenThreads = { readonly open: number; readonly stand: ThreadStand }

export const threadsOn = (state: TuiState, fileIndex: number): OpenThreads => {
  const patch = state.patches[fileIndex]
  const stands =
    patch === undefined
      ? []
      : state.sent
          .filter(
            (entry) =>
              entry.file === patch.path && entry.removed !== true && entry.settled !== true,
          )
          .map((entry) => threadStand(entry))
  return { open: stands.length, stand: stands.reduce(louderOf, "gone") }
}

export const threadsOpenOn = (
  state: TuiState,
  fileIndex: number,
  layerIndex?: number,
): ReadonlyArray<StagedComment> => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return []
  const open = state.sent.filter(
    (entry) => entry.file === patch.path && entry.removed !== true && entry.settled !== true,
  )
  const layer = layerIndex === undefined ? undefined : state.layers[layerIndex]
  if (layer === undefined || layerIndex === undefined) return open
  const last = lastLayerOf(state, fileIndex, layerIndex)
  const claimed = (entry: StagedComment): boolean =>
    state.layers.some((one) => coveredBy(one, patch.path, entry))
  return open.filter(
    (entry) => coveredBy(layer, patch.path, entry) || (last && !claimed(entry)),
  )
}

export const askedRows = (state: TuiState): ReadonlyArray<{
  readonly title: string
  readonly here: boolean
}> => {
  const asking = state.asking
  const what = asking?.layer === undefined ? "file" : "layer"
  const many = (asking?.threads.length ?? 0) === 1 ? "it" : "them"
  return [
    `Settle ${many} and mark the ${what} read`,
    `Mark the ${what} read and leave ${many} open`,
  ].map((title, at) => ({ title, here: at === state.askIndex }))
}

export const withAsking = (state: TuiState, asking: Asking): TuiState => ({
  ...state,
  screen: "settling",
  returnTo: state.screen,
  asking,
  askIndex: 0,
})

export const askingWords = (
  state: TuiState,
): { readonly name: string; readonly path: boolean; readonly tail: string } => {
  const asking = state.asking
  if (asking === undefined) return { name: "", path: false, tail: "" }
  const many = asking.threads.length
  return {
    name: asking.layer ?? asking.path,
    path: asking.layer === undefined,
    tail: ` still holds ${counted(many, "open thread")}`,
  }
}

export const markedStands = (state: TuiState): ReadonlyMap<number, ThreadStand> => {
  const patch = selectedPatch(state)
  const found = new Map<number, ThreadStand>()
  if (patch === undefined) return found
  const here = state.sent.filter(
    (entry) => entry.file === patch.path && entry.removed !== true && entry.outside !== true,
  )
  for (const entry of here) {
    const stand = threadStand(entry)
    for (const row of rowsUnder(patch, entry)) found.set(row, louderOf(stand, found.get(row) ?? "gone"))
  }
  return found
}

export const snippetOf = (state: TuiState, limit: number): ReadonlyArray<string> =>
  selectedRows(state)
    .slice(0, limit)
    .map((row) => `${lineOf(row).padStart(4)} ${row.text}`)

export const remarkAnswering = (state: TuiState): Remark | undefined =>
  state.answerTo === undefined
    ? undefined
    : state.remarks.find((one) => one.id === state.answerTo)

export const answerTarget = (state: TuiState): string => {
  const remark = remarkAnswering(state)
  return remark === undefined
    ? "Reply on the pull request"
    : `Reply to @${remark.by} on the pull request, ${remark.file}:${remark.end}`
}

export const replyTarget = (state: TuiState): string => {
  const thread = threadReplying(state)
  if (thread === undefined) return "Reply"
  const span = thread.start === thread.end ? `${thread.end}` : `${thread.start}-${thread.end}`
  return `Reply on ${thread.file}:${span}`
}

export const threadReplying = (state: TuiState): StagedComment | undefined =>
  state.replyTo === undefined
    ? undefined
    : state.sent.find((entry) => entry.id === state.replyTo)

const VOICES: Readonly<Record<"reviewer" | "agent", string>> = {
  reviewer: "you",
  agent: "the agent",
}

export const remarkQuote = (state: TuiState, room: number): ReadonlyArray<string> => {
  const remark = remarkAnswering(state)
  if (remark === undefined) return []
  const said = [{ by: remark.by, body: remark.body }, ...remark.replies]
  const saidBy = (turn: { readonly by: string; readonly body: string }): ReadonlyArray<string> => {
    const lines = wrapped(turn.body, Math.max(8, room - 4)).map((line) => `    ${line}`)
    return [`  @${turn.by}`, ...lines]
  }
  return said.flatMap(saidBy)
}

export const threadQuote = (state: TuiState, room: number): ReadonlyArray<string> => {
  const thread = threadReplying(state)
  if (thread === undefined) return []
  const spoken = (thread.answers ?? []).map((body) => ({ voice: "agent" as const, body }))
  const turns = thread.turns ?? [{ voice: "reviewer" as const, body: thread.body }, ...spoken]
  const saidBy = (turn: { voice: "reviewer" | "agent"; body: string }): ReadonlyArray<string> => {
    const lines = wrapped(turn.body, Math.max(8, room - 4)).map((line) => `    ${line}`)
    return [`  ${VOICES[turn.voice]}`, ...lines]
  }
  return turns.flatMap(saidBy)
}

export const needingRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> =>
  [...commentRowsIn(state, fileIndex), ...remarkRowsIn(state, fileIndex)].toSorted(
    (left, right) => left - right,
  )

export const commentRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> => {
  const patch =
    fileIndex === state.patchIndex ? selectedPatch(state) : state.patches[fileIndex]
  if (patch === undefined) return []
  const notes = state.sent.filter((entry) => entry.file === patch.path && entry.outside !== true)
  const rows = patch.rows.filter((row) =>
    notes.some((note) => lineOnSide(row, note.side) === note.end),
  )
  return rows.map((row) => row.index).toSorted((left, right) => left - right)
}

export type DraftPlace = { readonly row: number; readonly stop: number | undefined }

export const draftPlace = (state: TuiState): DraftPlace | undefined => {
  const patch = selectedPatch(state)
  if (patch === undefined) return undefined
  const to = state.replyTo ?? state.answerTo
  if (to === undefined) return { row: selectionRange(state)[1], stop: undefined }
  const drawn = notesShown(state, patch.path)
  const at = drawn.findIndex((note) => note.id === to)
  const note = drawn[at]
  if (note === undefined) return undefined
  const row = patch.rows.find((one) => lineOnSide(one, note.side) === note.end)?.index
  if (row === undefined) return undefined
  const above = drawn.filter(
    (one) => one.side === note.side && one.end === note.end && drawn.indexOf(one) <= at,
  ).length
  return { row, stop: above }
}

type Shown = {
  readonly id: string | undefined
  readonly side: "old" | "new"
  readonly end: number
}

const notesShown = (state: TuiState, path: string): ReadonlyArray<Shown> => [
  ...state.sent
    .filter((one) => one.file === path && one.removed !== true && one.outside !== true)
    .map((one) => ({ id: one.id, side: one.side, end: one.end })),
  ...state.remarks
    .filter((one) => one.file === path && remarkShown(one))
    .map((one) => ({ id: one.id, side: one.side, end: one.end })),
]

export const threadsAtRow = (state: TuiState, row: number): ReadonlyArray<StagedComment> => {
  const patch = selectedPatch(state)
  const here = patch?.rows[row]
  if (patch === undefined || here === undefined) return []
  return state.sent.filter(
    (entry) =>
      entry.file === patch.path &&
      entry.id !== undefined &&
      entry.removed !== true &&
      entry.outside !== true &&
      lineOnSide(here, entry.side) === entry.end,
  )
}

export const remarkShown = (remark: Remark): boolean =>
  remark.state === "waiting" && remark.placed

export const remarksAtRow = (state: TuiState, row: number): ReadonlyArray<Remark> => {
  const patch = selectedPatch(state)
  const here = patch?.rows[row]
  if (patch === undefined || here === undefined) return []
  return state.remarks.filter(
    (one) => one.file === patch.path && remarkShown(one) && lineOnSide(here, one.side) === one.end,
  )
}

export const remarkRowsIn = (state: TuiState, fileIndex: number): ReadonlyArray<number> => {
  const patch = fileIndex === state.patchIndex ? selectedPatch(state) : state.patches[fileIndex]
  if (patch === undefined) return []
  const here = state.remarks.filter((one) => one.file === patch.path && remarkShown(one))
  return patch.rows
    .filter((row) => here.some((one) => lineOnSide(row, one.side) === one.end))
    .map((row) => row.index)
}

export type Stop =
  | { readonly kind: "comment"; readonly comment: StagedComment }
  | { readonly kind: "remark"; readonly remark: Remark }

export const stopsIn = (state: TuiState, row: number): ReadonlyArray<Stop> => [
  ...threadsAtRow(state, row).map((comment): Stop => ({ kind: "comment", comment })),
  ...remarksAtRow(state, row).map((remark): Stop => ({ kind: "remark", remark })),
]

export const stopsAtRow = (state: TuiState, row: number): number => 1 + stopsIn(state, row).length

export const remarkAtStop = (state: TuiState): Remark | undefined => {
  if (state.stop === 0) return undefined
  const found = stopsIn(state, state.cursor)[state.stop - 1]
  return found?.kind === "remark" ? found.remark : undefined
}

export const remarkAtRow = (state: TuiState, row: number): Remark | undefined =>
  remarksAtRow(state, row)[0]

export type RemarkHere = { readonly remark: Remark; readonly dismissed: boolean }

const remarkInPanel = (state: TuiState): RemarkHere | undefined => {
  if (state.focus !== "review") return undefined
  const chosen = panelEntry(state)
  return chosen?.kind === "remark"
    ? { remark: chosen.remark, dismissed: chosen.section === "dismissed" }
    : undefined
}

const remarkInDiff = (state: TuiState, shy: boolean): Remark | undefined => {
  if (state.focus !== "diff") return undefined
  const standing = remarkAtStop(state)
  if (standing !== undefined) return standing
  if (state.stop > 0) return undefined
  if (shy && threadAtRow(state, state.cursor) !== undefined) return undefined
  return remarkAtRow(state, state.cursor)
}

export const remarkUnderCursor = (state: TuiState): RemarkHere | undefined => {
  const chosen = remarkInPanel(state)
  if (chosen !== undefined) return chosen
  const here = remarkInDiff(state, true)
  return here === undefined ? undefined : { remark: here, dismissed: false }
}

export const remarkHere = (state: TuiState): Remark | undefined =>
  remarkInPanel(state)?.remark ?? remarkInDiff(state, false)

export const cursorOnThread = (state: TuiState): boolean =>
  (state.stop > 0 && threadAtStop(state) !== undefined) || threadChosen(state) !== undefined

export const threadHere = (state: TuiState): StagedComment | undefined => {
  if (state.focus === "review") {
    const entry = panelEntry(state)
    return entry?.kind === "comment" ? entry.comment : undefined
  }
  return threadAtStop(state) ?? threadAtRow(state, state.cursor)
}

export const threadAtStop = (state: TuiState): StagedComment | undefined => {
  if (state.stop === 0) return undefined
  const found = stopsIn(state, state.cursor)[state.stop - 1]
  return found?.kind === "comment" ? found.comment : undefined
}

export const threadAtRow = (state: TuiState, row: number): StagedComment | undefined => {
  const patch = selectedPatch(state)
  const here = patch?.rows[row]
  if (patch === undefined || here === undefined) return undefined
  return state.sent.find(
    (entry) =>
      entry.file === patch.path &&
      entry.id !== undefined &&
      entry.removed !== true &&
      entry.outside !== true &&
      lineOnSide(here, entry.side) === entry.end,
  )
}

export const openCommentRows = (state: TuiState): ReadonlyArray<number> => {
  const patch = selectedPatch(state)
  if (patch === undefined) return []
  const open = state.sent.filter(
    (entry) =>
      entry.file === patch.path &&
      entry.settled !== true &&
      entry.removed !== true &&
      entry.outside !== true,
  )
  return patch.rows
    .filter(
      (row) =>
        open.some((note) => lineOnSide(row, note.side) === note.end) ||
        state.remarks.some(
          (one) => one.file === patch.path && remarkShown(one) && lineOnSide(row, one.side) === one.end,
        ),
    )
    .map((row) => row.index)
}

export const filesWithComments = (state: TuiState): ReadonlyArray<number> =>
  state.patches.flatMap((patch, index) =>
    state.sent.some((entry) => entry.file === patch.path) ||
    state.remarks.some((one) => one.file === patch.path && remarkShown(one))
      ? [index]
      : [],
  )

const answerCount = (comments: ReadonlyArray<StagedComment>): number =>
  comments.reduce((total, entry) => total + (entry.answers?.length ?? 0), 0)

export const answersSince = (
  seen: ReadonlyArray<StagedComment>,
  now: ReadonlyArray<StagedComment>,
): number => Math.max(0, answerCount(now) - answerCount(seen))

export const coveredBy = (
  layer: ReportedLayer,
  path: string,
  entry: StagedComment,
): boolean =>
  entry.side === "new" &&
  layer.spans.some(
    (span) => span.path === path && entry.start <= span.end && entry.end >= span.start,
  )

export const lastLayerOf = (state: TuiState, fileIndex: number, layerIndex: number): boolean =>
  state.layers.every(
    (layer, at) =>
      at === layerIndex ||
      !layer.spans.some((span) => span.path === state.patches[fileIndex]?.path) ||
      readIn(state, at, fileIndex),
  )

export const threadsInLayer = (
  state: TuiState,
  fileIndex: number,
  layerIndex: number,
): ReadonlyArray<StagedComment> => {
  const patch = state.patches[fileIndex]
  const layer = state.layers[layerIndex]
  if (patch === undefined || layer === undefined) return []
  return threadsOpenOn(state, fileIndex).filter((entry) => coveredBy(layer, patch.path, entry))
}

export const composeTarget = (state: TuiState): string => {
  const patch = selectedPatch(state)
  if (state.answerTo !== undefined) return answerTarget(state)
  if (state.replyTo !== undefined) return replyTarget(state)
  if (patch === undefined) return ""
  const [from, to] = selectionRange(state)
  const anchor = anchorFor(patch, from, to)
  const span = Option.match(anchor, {
    onNone: () => "",
    onSome: (found) => (found.start === found.end ? `${found.start}` : `${found.start}-${found.end}`),
  })
  return span === "" ? `Comment on ${patch.path}` : `Comment on ${patch.path}:${span}`
}
