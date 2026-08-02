import { Data } from "effect"

export class StoreUnwritable extends Data.TaggedError("StoreUnwritable")<{
  readonly path: string
  readonly reason: string
}> {}

export class StoreUnreadable extends Data.TaggedError("StoreUnreadable")<{
  readonly path: string
  readonly reason: string
}> {}
