import type { Anchor } from "../../domain/patch/index.ts"
import type { Step } from "../../domain/narrative/index.ts"

export type StoredStory = {
  readonly version: number
  readonly head: string
  readonly base: string
  readonly parent: number | undefined
  readonly written: string
  readonly summary: string
  readonly steps: ReadonlyArray<Step>
}

export type StoredComment = {
  readonly id: string
  readonly anchor: Anchor
  readonly body: string
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
}

export const emptyBranchState: BranchState = { vouches: {}, consumed: 0, pending: [] }
