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

export class UnselectableRange extends Data.TaggedError("UnselectableRange")<{
  readonly file: string
  readonly start: number
  readonly end: number
}> {}

export class UnknownCommand extends Data.TaggedError("UnknownCommand")<{
  readonly name: string
  readonly didYouMean?: string
  readonly verbs?: ReadonlyArray<string>
}> {}

export class MissingOption extends Data.TaggedError("MissingOption")<{
  readonly option: string
  readonly command?: string
  readonly usage?: string
}> {}

export class EmptyReview extends Data.TaggedError("EmptyReview")<{
  readonly branch: string
}> {}

export class UnknownWorktree extends Data.TaggedError("UnknownWorktree")<{
  readonly worktree: string
  readonly known: ReadonlyArray<string>
}> {}

export class MalformedLayers extends Data.TaggedError("MalformedLayers")<{
  readonly reason: string
}> {}

export class NoLayers extends Data.TaggedError("NoLayers")<{
  readonly worktree: string
}> {}

export class InitUnwritable extends Data.TaggedError("InitUnwritable")<{
  readonly path: string
  readonly reason: string
}> {}
