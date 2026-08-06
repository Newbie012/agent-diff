import type { Anchor } from "../../domain/patch/index.ts"
import type { Layer } from "../../domain/layers/index.ts"

export type StoredLayers = {
  readonly version: number
  readonly head: string
  readonly base: string
  readonly parent: number | undefined
  readonly written: string
  readonly summary: string
  readonly layers: ReadonlyArray<Layer>
}

export type StoredComment = {
  readonly id: string
  readonly anchor: Anchor
  readonly body: string
}

export type StoredAnswer = {
  readonly comment: string
  readonly body: string
  readonly head: string
  readonly asks: boolean
  readonly at: string
}

export type Batch = {
  readonly id: string
  readonly at: string
  readonly head: string
  readonly comments: ReadonlyArray<StoredComment>
}

export type BranchState = {
  readonly vouches: Readonly<Record<string, string>>
  readonly consumed: number
  readonly pending: ReadonlyArray<StoredComment>
  readonly settled: Readonly<Record<string, string>>
  readonly removed: Readonly<Record<string, string>>
}

export const emptyBranchState: BranchState = {
  vouches: {},
  consumed: 0,
  pending: [],
  settled: {},
  removed: {},
}

export type Settings = {
  readonly wrap?: boolean
}

export type UpgradeCheck = {
  readonly note?: string
  readonly checkedAt?: string
  readonly latest?: string
  readonly told?: string
}
