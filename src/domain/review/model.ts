import { Schema } from "effect"
import type { Option } from "effect"
import type { Anchor } from "../patch/index.ts"

export const CommentId = Schema.String.pipe(Schema.brand("@adiff/CommentId"))
export type CommentId = typeof CommentId.Type

export type CommentState = "draft" | "submitted" | "seen" | "working" | "question" | "done" | "wontfix"

export type Comment = {
  readonly id: string
  readonly anchor: Anchor
  readonly body: string
  readonly state: CommentState
  readonly reply: Option.Option<string>
}

export type Vouches = Readonly<Record<string, string>>

export type VouchedFile = {
  readonly path: string
  readonly blob: string
}
