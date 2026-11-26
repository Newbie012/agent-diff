import { Data } from "effect"

export class GrammarUnreadable extends Data.TaggedError("GrammarUnreadable")<{
  readonly path: string
  readonly reason: string
}> {}
