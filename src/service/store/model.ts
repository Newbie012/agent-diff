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
  readonly replyTo?: string
}

export type StoredDraft = {
  readonly id: string
  readonly anchor: Anchor
  readonly body: string
  readonly at: string
  readonly wroteBy: "reviewer" | "agent"
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
  readonly settled: Readonly<Record<string, string>>
  readonly removed: Readonly<Record<string, string>>
  readonly base: string
  readonly read: Readonly<Record<string, number>>
}

export const emptyBranchState: BranchState = {
  vouches: {},
  consumed: 0,
  settled: {},
  removed: {},
  base: "",
  read: {},
}

export type Settings = {
  readonly wrap?: boolean
  readonly sticky?: boolean
  readonly panel?: boolean
  readonly hideReviewed?: boolean
  readonly hideSettled?: boolean
  readonly newestFirst?: boolean
  readonly hold?: boolean
}

export type UpgradeCheck = {
  readonly note?: string
  readonly checkedAt?: string
  readonly latest?: string
  readonly told?: string
}
