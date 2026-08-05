import { Data } from "effect"

export class ForgeUnavailable extends Data.TaggedError("ForgeUnavailable")<{
  readonly repo: string
  readonly reason: string
}> {}
