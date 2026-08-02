import type { Patch } from "../domain/patch/index.ts"
import type { BranchSummary } from "../cli/index.ts"

export type Screen = "branches" | "review" | "compose"

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
})

export const selectedBranch = (state: TuiState): BranchSummary | undefined =>
  state.branches[state.branchIndex]

export const selectedPatch = (state: TuiState): Patch | undefined => state.patches[state.patchIndex]

export const selectionRange = (state: TuiState): readonly [number, number] =>
  state.anchorRow <= state.cursor ? [state.anchorRow, state.cursor] : [state.cursor, state.anchorRow]
