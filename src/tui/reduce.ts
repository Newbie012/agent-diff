import type { Patch } from "../domain/patch/index.ts"
import type { Action } from "./keymap.ts"
import { selectedPatch, type TuiState } from "./model.ts"

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, value))

const lastRow = (patch: Patch | undefined): number => Math.max(0, (patch?.rows.length ?? 1) - 1)

const moveCursor = (state: TuiState, delta: number): TuiState => ({
  ...state,
  cursor: clamp(state.cursor + delta, 0, lastRow(selectedPatch(state))),
})

const moveBranch = (state: TuiState, delta: number): TuiState => ({
  ...state,
  branchIndex: clamp(state.branchIndex + delta, 0, Math.max(0, state.branches.length - 1)),
})

const moveFile = (state: TuiState, delta: number): TuiState => ({
  ...state,
  patchIndex: clamp(state.patchIndex + delta, 0, Math.max(0, state.patches.length - 1)),
  cursor: 0,
  anchorRow: 0,
  selecting: false,
})

const startSelection = (state: TuiState): TuiState => ({
  ...state,
  selecting: true,
  anchorRow: state.cursor,
})

const openCompose = (state: TuiState): TuiState => ({
  ...state,
  screen: "compose",
  draft: "",
  anchorRow: state.selecting ? state.anchorRow : state.cursor,
})

const goBack = (state: TuiState): TuiState => {
  if (state.screen === "compose") return { ...state, screen: "review", draft: "" }
  return { ...state, screen: "branches", selecting: false }
}

const transitions: Record<Action, (state: TuiState) => TuiState> = {
  "branch.next": (state) => moveBranch(state, 1),
  "branch.prev": (state) => moveBranch(state, -1),
  "branch.open": (state) => state,
  "cursor.next": (state) => moveCursor(state, 1),
  "cursor.prev": (state) => moveCursor(state, -1),
  "file.next": (state) => moveFile(state, 1),
  "file.prev": (state) => moveFile(state, -1),
  "select.start": startSelection,
  "compose.open": openCompose,
  "compose.submit": (state) => state,
  back: goBack,
  quit: (state) => state,
}

export const reduce = (state: TuiState, action: Action): TuiState => transitions[action](state)

export const withPatches = (state: TuiState, patches: ReadonlyArray<Patch>): TuiState => ({
  ...state,
  screen: "review",
  patches,
  patchIndex: 0,
  cursor: 0,
  anchorRow: 0,
  selecting: false,
})

export const typed = (state: TuiState, character: string): TuiState => ({
  ...state,
  draft: `${state.draft}${character}`,
})

export const backspaced = (state: TuiState): TuiState => ({
  ...state,
  draft: state.draft.slice(0, -1),
})

export const withNotice = (state: TuiState, notice: string): TuiState => ({
  ...state,
  screen: "review",
  draft: "",
  selecting: false,
  notice,
})
