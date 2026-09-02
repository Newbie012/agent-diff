import { WHOLE_FILE } from "../domain/patch/index.ts"
import { buildTree, crowdedDirectories, flattenTree, type Tree, type TreeRow } from "./tree.ts"
import { partOf } from "../domain/review/index.ts"
import { carriesLine } from "./cursor.ts"
import { onLayers, selectedPatch, type TuiState } from "./state.ts"

export const treeOf = (state: TuiState): Tree =>
  buildTree(state.patches.map((patch, at) => (fileShown(state, at) ? patch.path : "")))

export const reviewedCountIn = (state: TuiState): number =>
  state.patches.filter((_, at) => isReviewed(state, at)).length

const CROWDED = 8

export const treeRows = (state: TuiState): ReadonlyArray<TreeRow> => {
  const tree = treeOf(state)
  return flattenTree(tree, state.closed)
}

export const crowdedOf = (patches: TuiState["patches"]): ReadonlyArray<string> =>
  crowdedDirectories(buildTree(patches.map((patch) => patch.path)), CROWDED)

export const foldersOfFile = (state: TuiState, fileIndex: number): ReadonlyArray<string> => {
  const patch = state.patches[fileIndex]
  if (patch === undefined) return []
  const drawn = new Set(
    flattenTree(treeOf(state), [])
      .filter((row) => row.kind !== "file")
      .map((row) => row.path),
  )
  const segments = patch.path.split("/").slice(0, -1)
  return segments
    .map((_, at) => segments.slice(0, segments.length - at).join("/"))
    .filter((path) => drawn.has(path))
}

export const isReviewed = (state: TuiState, fileIndex: number): boolean => {
  const patch = state.patches[fileIndex]
  return patch !== undefined && state.vouched.includes(patch.path)
}

export const treeStart = (state: TuiState, height: number): number => {
  const rows = treeRows(state)
  if (rows.length <= height) return 0
  const last = rows.length - height
  if (state.railScroll >= 0) return Math.min(state.railScroll, last)
  const here = rows.findIndex((row) => row.fileIndex === state.patchIndex)
  const anchor = here === -1 ? 0 : here
  return Math.max(0, Math.min(last, anchor - Math.floor(height / 2)))
}

export const treeWindow = (
  state: TuiState,
  height: number,
): { readonly rows: ReadonlyArray<TreeRow>; readonly more: number } => {
  const rows = treeRows(state)
  if (rows.length <= height) return { rows, more: 0 }
  const start = treeStart(state, height)
  return { rows: rows.slice(start, start + height), more: rows.length - (start + height) }
}

export const CONTEXT_STEPS: ReadonlyArray<number> = [3, 10, 25, 60, WHOLE_FILE]

const wholeFileOff = (state: TuiState): boolean => state.context < WHOLE_FILE

export const contextToggled = (state: TuiState): number =>
  wholeFileOff(state) ? WHOLE_FILE : state.contextWas

export const hunkStarts = (state: TuiState): ReadonlyArray<number> => {
  const rows = selectedPatch(state)?.rows ?? []
  const starts: Array<number> = []
  let running = false
  for (const [index, row] of rows.entries()) {
    const changed = row.kind !== "context"
    if (changed && !running) starts.push(index)
    running = changed
  }
  return starts
}

export const openingRow = (state: TuiState, patchIndex: number): number => {
  const rows = state.patches[patchIndex]?.rows ?? []
  const at = rows.findIndex((row) => carriesLine(row))
  return at === -1 ? 0 : at
}

export const changeAround = (state: TuiState): readonly [number, number] | undefined => {
  const rows = selectedPatch(state)?.rows ?? []
  const changed = (at: number): boolean => {
    const row = rows[at]
    return row !== undefined && row.kind !== "context"
  }
  if (!changed(state.cursor)) return undefined
  let first = state.cursor
  let last = state.cursor
  while (changed(first - 1)) first -= 1
  while (changed(last + 1)) last += 1
  return [first, last]
}

export const nextUnreviewed = (state: TuiState, from: number): number | undefined => {
  const order = fileOrder(state)
  const start = Math.max(0, order.indexOf(from))
  const rotated = [...order.slice(start + 1), ...order.slice(0, start + 1)]
  return rotated.find((index) => !isReviewed(state, index))
}

export const reviewedCount = (state: TuiState): string =>
  `${state.vouched.length} reviewed`

export const fileShown = (state: TuiState, at: number): boolean =>
  !state.hideReviewed || at === state.patchIndex || !isReviewed(state, at)

export const fileOrder = (state: TuiState): ReadonlyArray<number> =>
  onLayers(state)
    ? state.layers.flatMap((_, at) => layerFiles(state, at))
    : flattenTree(treeOf(state), []).flatMap((row) =>
        row.fileIndex === undefined ? [] : [row.fileIndex],
      )

export const filePlace = (state: TuiState): { readonly at: number; readonly of: number } => {
  const order = readingOrder(state)
  const at = placeIn(state)
  if (at === -1) return { at: state.patchIndex + 1, of: state.patches.length }
  return { at: at + 1, of: order.length }
}

export const readingOrder = (
  state: TuiState,
): ReadonlyArray<{ readonly layer: number; readonly file: number }> =>
  onLayers(state)
    ? state.layers.flatMap((_, layer) =>
        layerFiles(state, layer).map((file) => ({ layer, file })),
      )
    : fileOrder(state).map((file) => ({ layer: state.layerIndex, file }))

export const placeIn = (state: TuiState): number => {
  const order = readingOrder(state)
  const at = order.findIndex(
    (one) => one.file === state.patchIndex && (!onLayers(state) || one.layer === state.layerIndex),
  )
  return at === -1 ? order.findIndex((one) => one.file === state.patchIndex) : at
}

export const layerFile = (state: TuiState, delta: number): number => {
  const order = readingOrder(state)
  const at = placeIn(state)
  if (at === -1) return order[0]?.file ?? state.patchIndex
  const next = Math.max(0, Math.min(order.length - 1, at + delta))
  return order[next]?.file ?? state.patchIndex
}

export const layerAfter = (state: TuiState, delta: number): number => {
  const order = readingOrder(state)
  const at = placeIn(state)
  if (at === -1) return order[0]?.layer ?? state.layerIndex
  const next = Math.max(0, Math.min(order.length - 1, at + delta))
  return order[next]?.layer ?? state.layerIndex
}

export const layerFiles = (state: TuiState, layerIndex: number): ReadonlyArray<number> =>
  layerHolds(state, layerIndex).filter((at) => fileShown(state, at))

export const readIn = (state: TuiState, layerIndex: number, fileIndex: number): boolean => {
  if (isReviewed(state, fileIndex)) return true
  const part = partHere(state, layerIndex, fileIndex)
  return part !== undefined && state.partsRead.includes(part)
}

export const layerHolds = (state: TuiState, layerIndex: number): ReadonlyArray<number> => {
  const layer = state.layers[layerIndex]
  if (layer === undefined) return []
  return layer.files.flatMap((path) => {
    const at = state.patches.findIndex((patch) => patch.path === path)
    return at === -1 ? [] : [at]
  })
}

export const partHere = (
  state: TuiState,
  layerIndex: number,
  fileIndex: number,
): string | undefined => {
  const path = state.patches[fileIndex]?.path
  const layer = state.layers[layerIndex]
  if (path === undefined || layer === undefined) return undefined
  const spans = layer.spans.filter((span) => span.path === path)
  return spans.length === 0 ? undefined : partOf(path, spans)
}

export const layersHolding = (state: TuiState, fileIndex: number): number =>
  state.layers.filter((layer) =>
    layer.spans.some((span) => span.path === state.patches[fileIndex]?.path),
  ).length
