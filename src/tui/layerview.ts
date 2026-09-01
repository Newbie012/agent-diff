import type { ProseAnchor } from "../domain/layers/index.ts"
import { CONTEXT_STEPS, isReviewed, layerFiles, layerHolds, readIn } from "./files.ts"
import { treeWidth } from "./layout.ts"
import { type LayerRow, onLayers, selectedLayer, type TuiState } from "./state.ts"
import { clip, wordWrapped, wrapped } from "./words.ts"

export const proseFor = (state: TuiState, path: string): ReadonlyArray<ProseAnchor> => {
  if (!onLayers(state)) return []
  const layer = selectedLayer(state)
  if (layer === undefined) return []
  return layer.prose.filter((anchor) => anchor.path === path)
}

export const layerHolding = (state: TuiState, fileIndex: number): number => {
  const path = state.patches[fileIndex]?.path
  const at = state.layers.findIndex((layer) => layer.files.includes(path ?? ""))
  return at === -1 ? state.layerIndex : at
}

export const layerOpen = (state: TuiState, layerIndex: number): boolean =>
  state.openLayers.includes(layerIndex)

const TITLE_ROWS = 2

const titleRows = (
  state: TuiState,
  layerIndex: number,
  room: number,
  marked: boolean,
): ReadonlyArray<LayerRow> => {
  const lines = wordWrapped(state.layers[layerIndex]?.title ?? "", room)
  const heldLines = lines.slice(0, TITLE_ROWS)
  const last = heldLines.at(-1) ?? ""
  const said =
    lines.length > TITLE_ROWS
      ? [...heldLines.slice(0, -1), clip(`${last} …`, room)]
      : heldLines
  return said.map((text, at) => ({
    index: layerIndex,
    kind: "title" as const,
    text,
    lead: at === 0,
    here: at === 0 && marked,
  }))
}

const shortDir = (dir: string, room: number): string => {
  const whole = `${dir}/`
  if (whole.length <= room) return whole
  const parts = dir.split("/")
  const last = parts.at(-1) ?? ""
  const shrunk = parts.length < 3 ? "" : `${parts[0] ?? ""}/…/${last}/`
  if (shrunk.length > 0 && shrunk.length <= room) return shrunk
  const tail = `…/${last}/`
  if (tail.length <= room) return tail
  return `${clip(last, Math.max(1, room - 1))}/`
}

const fileRow = (state: TuiState, layerIndex: number, at: number, room: number): LayerRow => {
  const path = state.patches[at]?.path ?? ""
  const name = path.split("/").at(-1) ?? path
  return {
    index: layerIndex,
    kind: "file",
    text: clip(name, room),
    lead: false,
    fileIndex: at,
    reviewed: readIn(state, layerIndex, at),
    here: at === state.patchIndex && layerIndex === state.layerIndex,
  }
}

const shownFiles = (state: TuiState, layerIndex: number): ReadonlyArray<number> =>
  layerFiles(state, layerIndex).filter(
    (at) => !(state.hideReviewed && isReviewed(state, at) && at !== state.patchIndex),
  )

const dirOf = (state: TuiState, at: number): string => {
  const parts = (state.patches[at]?.path ?? "").split("/")
  return parts.slice(0, -1).join("/")
}

const fileRows = (
  state: TuiState,
  layerIndex: number,
  room: { readonly dir: number; readonly file: number },
): ReadonlyArray<LayerRow> => {
  const rows: Array<LayerRow> = []
  let held: string | undefined
  for (const at of shownFiles(state, layerIndex)) {
    const dir = dirOf(state, at)
    if (dir !== held && dir.length > 0) {
      rows.push({ index: layerIndex, kind: "dir", text: shortDir(dir, room.dir), lead: false })
    }
    held = dir
    rows.push(fileRow(state, layerIndex, at, room.file))
  }
  return rows
}

export const layerRead = (state: TuiState, layerIndex: number): { done: number; all: number } => {
  const files = layerHolds(state, layerIndex)
  return { done: files.filter((at) => readIn(state, layerIndex, at)).length, all: files.length }
}

export const layerDone = (state: TuiState, layerIndex: number): boolean => {
  const read = layerRead(state, layerIndex)
  return read.all > 0 && read.done === read.all
}

export type LayerRoom = {
  readonly title: number
  readonly dir: number
  readonly file: number
}

const countRow = (state: TuiState, index: number, room: number): ReadonlyArray<LayerRow> => {
  const read = layerRead(state, index)
  if (read.all === 0) return []
  const one = read.all === 1 ? "file" : "files"
  const said = `${read.done} of ${read.all} ${one} read`
  return [{ index, kind: "count", text: clip(said, room), lead: false }]
}

const NOTHING_LEFT = "nothing in this diff"

const textRows = (
  index: number,
  text: string,
  room: number,
  kind: "count" | "note",
): ReadonlyArray<LayerRow> =>
  wrapped(text, room).map((line) => ({ index, kind, text: line, lead: false }))

const emptyRows = (state: TuiState, index: number, room: number): ReadonlyArray<LayerRow> => {
  const layer = state.layers[index]
  if (layer === undefined) return []
  const gone = layer.vanished
  const said = gone.length === 0 ? NOTHING_LEFT : `${NOTHING_LEFT}: ${gone.join(", ")}`
  return [...textRows(index, said, room, "count"), ...textRows(index, layer.note, room, "note")]
}

const layerBody = (
  state: TuiState,
  index: number,
  room: LayerRoom,
  shown: ReadonlySet<number>,
): ReadonlyArray<LayerRow> => {
  if (layerRead(state, index).all === 0) return emptyRows(state, index, room.file)
  if (!layerOpen(state, index) || !shown.has(index)) return countRow(state, index, room.file)
  const rows = fileRows(state, index, room)
  return rows.length > 0 ? rows : countRow(state, index, room.file)
}

const holdsCursor = (state: TuiState, index: number): boolean =>
  index === state.layerIndex && layerFiles(state, index).includes(state.patchIndex)

const layerCard = (
  state: TuiState,
  index: number,
  room: LayerRoom,
  shown: ReadonlySet<number>,
): ReadonlyArray<LayerRow> => {
  const body = layerBody(state, index, room, shown)
  const marked = holdsCursor(state, index) && !body.some((row) => row.here === true)
  return [...titleRows(state, index, room.title, marked), ...body]
}

export const layerRows = (
  state: TuiState,
  room: LayerRoom,
  shown: ReadonlySet<number>,
): ReadonlyArray<LayerRow> =>
  state.layers.flatMap((_, index) => [
    ...(index > 0 ? [{ index, kind: "gap" as const, text: "", lead: false }] : []),
    ...layerCard(state, index, room, shown),
  ])

const nearFirst = (state: TuiState): ReadonlyArray<number> =>
  state.layers
    .map((_, at) => at)
    .filter((at) => layerOpen(state, at))
    .toSorted((one, two) => Math.abs(one - state.layerIndex) - Math.abs(two - state.layerIndex))

export const layerFitted = (
  state: TuiState,
  room: LayerRoom,
  height: number,
): ReadonlyArray<LayerRow> => {
  const every = new Set(state.layers.map((_, at) => at))
  const whole = layerRows(state, room, every)
  if (whole.length <= height) return whole
  const shown = new Set<number>([state.layerIndex])
  for (const at of nearFirst(state)) {
    shown.add(at)
    if (layerRows(state, room, shown).length > height) shown.delete(at)
  }
  shown.add(state.layerIndex)
  return layerRows(state, room, shown)
}

export type RailWindow = {
  readonly rows: ReadonlyArray<LayerRow>
  readonly more: number
  readonly above: number
}

const restingAt = (
  rows: ReadonlyArray<LayerRow>,
  height: number,
  layerIndex: number,
): number => {
  const first = Math.max(0, rows.findIndex((row) => row.index === layerIndex))
  const block = rows.findLastIndex((row) => row.index === layerIndex) - first + 1
  return block >= height ? first : first - Math.floor((height - block) / 2)
}

export const railTop = (
  rows: ReadonlyArray<LayerRow>,
  height: number,
  layerIndex: number,
  scroll: number,
): number => {
  const wanted = scroll >= 0 ? scroll : restingAt(rows, height, layerIndex)
  return Math.max(0, Math.min(Math.max(0, rows.length - height), wanted))
}

const PANE_CHROME = 3

export const RAIL_STEP = 2

export const RAIL_GUTTER = 3

export const RAIL_TITLE_LEAD = RAIL_GUTTER + 1

export const RAIL_DIR_LEAD = RAIL_TITLE_LEAD + RAIL_STEP

export const RAIL_FILE_LEAD = RAIL_DIR_LEAD + RAIL_STEP

export const layerRoomIn = (state: TuiState): LayerRoom => {
  const whole = Math.max(8, treeWidth(state.columns) - PANE_CHROME)
  return {
    title: Math.max(4, whole - RAIL_TITLE_LEAD),
    dir: Math.max(4, whole - RAIL_DIR_LEAD),
    file: Math.max(4, whole - RAIL_FILE_LEAD),
  }
}

export const railRowsFor = (state: TuiState): ReadonlyArray<LayerRow> =>
  layerFitted(state, layerRoomIn(state), Math.max(1, state.railRows))

export const railWindow = (
  rows: ReadonlyArray<LayerRow>,
  height: number,
  layerIndex: number,
  scroll = -1,
): RailWindow => {
  if (rows.length <= height) return { rows, more: 0, above: 0 }
  const start = railTop(rows, height, layerIndex, scroll)
  const shown = rows.slice(start, start + height)
  const here = new Set(shown.map((row) => row.index))
  const seen = (from: ReadonlyArray<LayerRow>): number =>
    new Set(from.filter((row) => !here.has(row.index)).map((row) => row.index)).size
  return {
    rows: shown,
    more: seen(rows.slice(start + height)),
    above: seen(rows.slice(0, start)),
  }
}

export const layerContext = (current: number, delta: number): number => {
  const at = CONTEXT_STEPS.indexOf(current)
  const next = Math.max(0, Math.min(CONTEXT_STEPS.length - 1, (at === -1 ? 0 : at) + delta))
  return CONTEXT_STEPS[next] ?? current
}
