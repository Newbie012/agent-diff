import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { Effect } from "effect"
import { GitCommandFailed } from "./error.ts"

const exec = promisify(execFile)

const MAX_OUTPUT = 64 * 1024 * 1024

export const git = Effect.fn("Git.run")(function* (cwd: string, args: ReadonlyArray<string>) {
  return yield* Effect.tryPromise({
    try: (signal: AbortSignal) =>
      exec("git", [...args], { cwd, maxBuffer: MAX_OUTPUT, encoding: "utf8", signal }),
    catch: (cause) =>
      new GitCommandFailed({
        command: args,
        cwd,
        stderr: cause instanceof Error ? cause.message : String(cause),
      }),
  }).pipe(Effect.map((result) => result.stdout))
})

export const gitOrEmpty = Effect.fn("Git.runOrEmpty")(function* (
  cwd: string,
  args: ReadonlyArray<string>,
) {
  return yield* git(cwd, args).pipe(Effect.catchTag("GitCommandFailed", () => Effect.succeed("")))
})
