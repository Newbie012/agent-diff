import type { Anchor } from "../../domain/patch/index.ts"

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
}

export const emptyBranchState: BranchState = { vouches: {}, consumed: 0 }
