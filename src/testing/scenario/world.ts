import { series } from "../state.ts"
import type { World } from "./model.ts"

export type WorldHands = {
  readonly [K in keyof Required<World>]: (value: NonNullable<World[K]>) => Promise<void>
}

const ORDER: { readonly [K in keyof Required<World>]: number } = {
  branch: 0,
  remarks: 1,
  readsRemarks: 2,
  layers: 3,
}

const parts = (): ReadonlyArray<keyof World> =>
  (Object.keys(ORDER) as ReadonlyArray<keyof World>).toSorted((left, right) => ORDER[left] - ORDER[right])

export const worldParts = parts

export const applyWorld = (world: World, hands: WorldHands): Promise<void> =>
  series(parts(), async (part) => {
    const value = world[part]
    if (value === undefined) return
    await (hands[part] as (held: unknown) => Promise<void>)(value)
  })
