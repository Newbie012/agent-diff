import type { CliRenderer } from "@opentui/core"
import type { Effect, FiberHandle } from "effect"
import type { BranchReading } from "../review/index.ts"
import type { Needs, Work } from "./needs.ts"
import type { Screen } from "./render.ts"
import type { TuiState } from "./state.ts"

export type Timing = { readonly action: string; readonly ms: number }

export type Diagnostics = {
  readonly slowest: ReadonlyArray<Timing>
  readonly keys: ReadonlyArray<string>
  readonly trail: ReadonlyArray<string>
  readonly failure: string
  readonly failureKind: string
}

export type Aside = FiberHandle.FiberHandle<void, never>

export interface Terminal {
  readonly repo: string
  readonly base: string | undefined
  readonly renderer: CliRenderer
  readonly screen: Screen
  readonly state: TuiState
  reading: BranchReading | undefined
  readonly sourcing: Aside
  readonly fetching: Aside
  readonly searching: Aside
  readonly lighting: Aside
  readonly looking: Aside
  commit(next: TuiState): void
  write(next: TuiState): void
  measured(): TuiState
  standing(): TuiState
  dispatch(task: Work): void
  aside(handle: Aside, work: Work): Effect.Effect<void, never, Needs>
  diagnostics(): Diagnostics
}
