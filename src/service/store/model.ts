import type * as Wire from "./schema.ts"

export type StoredLayers = typeof Wire.StoredLayers.Type

export type StoredRemarks = typeof Wire.StoredRemarks.Type

export type StoredRemark = typeof Wire.StoredRemark.Type

export type StoredComment = typeof Wire.StoredComment.Type

export type StoredDraft = typeof Wire.StoredDraft.Type

export type StoredAnswer = typeof Wire.StoredAnswer.Type

export type Batch = typeof Wire.Batch.Type

export type BranchState = typeof Wire.BranchState.Type

export type Settings = typeof Wire.Settings.Type

export type Watching = typeof Wire.Watching.Type

export type UpgradeCheck = typeof Wire.UpgradeCheck.Type

export const emptyBranchState: BranchState = {
  taken: {},
  vouches: {},
  parts: {},
  consumed: 0,
  settled: {},
  removed: {},
  base: "",
  read: {},
  dismissed: {},
}
