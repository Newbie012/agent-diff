import type { BranchTestModel } from "../domains/branch/index.ts"
import type { LayersInput } from "../domains/app/index.ts"

export type Change = {
  readonly file: string
  readonly lines: ReadonlyArray<string>
  readonly message: string
}

export type Step = {
  readonly does: string
  readonly keys: ReadonlyArray<string>
  readonly change?: Change
}

export type Seat = {
  readonly width: number
  readonly height: number
}

export type World = {
  readonly branch: Partial<BranchTestModel>
  readonly layers?: LayersInput
}

export type Scenario = {
  readonly name: string
  readonly world: World
  readonly seat: Seat
  readonly steps: ReadonlyArray<Step>
}

export const AT_A_DESK: Seat = { width: 150, height: 34 }

export const scenario = (
  said: Omit<Scenario, "seat"> & { readonly seat?: Seat },
): Scenario => ({
  name: said.name,
  world: said.world,
  seat: said.seat ?? AT_A_DESK,
  steps: said.steps,
})
