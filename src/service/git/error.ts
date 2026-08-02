import { Data } from "effect"

export class GitCommandFailed extends Data.TaggedError("GitCommandFailed")<{
  readonly command: ReadonlyArray<string>
  readonly cwd: string
  readonly stderr: string
}> {}

export class NotARepository extends Data.TaggedError("NotARepository")<{
  readonly path: string
}> {}

export class FileUnreadable extends Data.TaggedError("FileUnreadable")<{
  readonly path: string
  readonly reason: string
}> {}
