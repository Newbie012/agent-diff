import { Data } from "effect"

export class UnknownBranch extends Data.TaggedError("UnknownBranch")<{
  readonly repo: string
  readonly branch: string
  readonly known: ReadonlyArray<string>
}> {}

export class UnknownFile extends Data.TaggedError("UnknownFile")<{
  readonly file: string
  readonly known: ReadonlyArray<string>
}> {}

export class UnselectableRange extends Data.TaggedError("UnselectableRange")<{
  readonly file: string
  readonly start: number
  readonly end: number
}> {}

export class UnknownCommand extends Data.TaggedError("UnknownCommand")<{
  readonly name: string
  readonly known: ReadonlyArray<string>
}> {}

export class MissingOption extends Data.TaggedError("MissingOption")<{
  readonly option: string
}> {}

export class EmptyReview extends Data.TaggedError("EmptyReview")<{
  readonly branch: string
}> {}

export class UnknownWorktree extends Data.TaggedError("UnknownWorktree")<{
  readonly worktree: string
  readonly known: ReadonlyArray<string>
}> {}

export class MalformedStory extends Data.TaggedError("MalformedStory")<{
  readonly reason: string
}> {}

export class NoStory extends Data.TaggedError("NoStory")<{
  readonly worktree: string
}> {}
