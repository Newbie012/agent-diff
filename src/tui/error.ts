import { Data } from "effect"

export class SessionUnreadable extends Data.TaggedError("SessionUnreadable")<{
  readonly path: string
  readonly reason: string
}> {}

export class SessionUnwritable extends Data.TaggedError("SessionUnwritable")<{
  readonly path: string
  readonly reason: string
}> {}
