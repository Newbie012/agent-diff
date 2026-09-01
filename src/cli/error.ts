import { Data } from "effect"

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

export class UnknownField extends Data.TaggedError("UnknownField")<{
  readonly field: string
  readonly known: ReadonlyArray<string>
}> {}

export class UnknownOption extends Data.TaggedError("UnknownOption")<{
  readonly option: string
  readonly known: ReadonlyArray<string>
}> {}

export class BadOption extends Data.TaggedError("BadOption")<{
  readonly option: string
  readonly given: string
  readonly allowed: ReadonlyArray<string>
}> {}
