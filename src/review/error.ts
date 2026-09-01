import { Data } from "effect"

export class UnknownBranch extends Data.TaggedError("UnknownBranch")<{
  readonly repo: string
  readonly branch: string
  readonly known: ReadonlyArray<string>
}> {}

export class UnknownBase extends Data.TaggedError("UnknownBase")<{
  readonly branch: string
  readonly base: string
  readonly reason: "missing" | "unrelated"
}> {}

export class UnknownFile extends Data.TaggedError("UnknownFile")<{
  readonly file: string
  readonly known: ReadonlyArray<string>
}> {}

export class UnknownComment extends Data.TaggedError("UnknownComment")<{
  readonly id: string
}> {}

export class UnknownRemark extends Data.TaggedError("UnknownRemark")<{
  readonly id: string
  readonly known: ReadonlyArray<string>
}> {}

export class NothingSaid extends Data.TaggedError("NothingSaid")<{
  readonly what: string
}> {}

export class ThreadOpen extends Data.TaggedError("ThreadOpen")<{
  readonly id: string
}> {}

export class RemarkTaken extends Data.TaggedError("RemarkTaken")<{
  readonly id: string
  readonly comment: string
}> {}

export class UnknownPreference extends Data.TaggedError("UnknownPreference")<{
  readonly name: string
  readonly known: ReadonlyArray<string>
}> {}

export class UnknownPreferenceValue extends Data.TaggedError("UnknownPreferenceValue")<{
  readonly name: string
  readonly value: string
  readonly known: ReadonlyArray<string>
}> {}

export class UnselectableRange extends Data.TaggedError("UnselectableRange")<{
  readonly file: string
  readonly start: number
  readonly end: number
}> {}

export class UnknownWorktree extends Data.TaggedError("UnknownWorktree")<{
  readonly worktree: string
  readonly known: ReadonlyArray<string>
}> {}

export class MalformedLayers extends Data.TaggedError("MalformedLayers")<{
  readonly reason: string
}> {}

export class UnknownDraft extends Data.TaggedError("UnknownDraft")<{
  readonly id: string
}> {}

export class NothingDrafted extends Data.TaggedError("NothingDrafted")<{
  readonly branch: string
}> {}

export class PartlySent extends Data.TaggedError("PartlySent")<{
  readonly branch: string
  readonly url: string
  readonly sent: number
  readonly held: number
  readonly landed: ReadonlyArray<string>
  readonly kept: ReadonlyArray<string>
}> {}

export class PullMoved extends Data.TaggedError("PullMoved")<{
  readonly branch: string
  readonly was: string
  readonly now: string
}> {}

export class NoLayers extends Data.TaggedError("NoLayers")<{
  readonly worktree: string
}> {}
