import { randomUUID } from "node:crypto"
import { Cause, Effect, Exit, Layer } from "effect"
import { listBranches, numeric, optionsFrom, required, submitComment, UnknownCommand } from "./cli/index.ts"
import { GitLive } from "./service/git/index.ts"
import { storeAt, defaultRoot } from "./service/store/index.ts"

const emit = (value: unknown): Effect.Effect<void> =>
  Effect.sync(() => process.stdout.write(`${JSON.stringify(value)}\n`))

const branchesCommand = Effect.fn("Main.branches")(function* (options: Record<string, string>) {
  const repo = yield* required(options, "repo")
  const branches = yield* listBranches(repo)
  yield* emit({ ok: true, branches })
})

const commentCommand = Effect.fn("Main.comment")(function* (options: Record<string, string>) {
  const batch = yield* submitComment({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    file: yield* required(options, "file"),
    start: yield* numeric(options, "start"),
    end: yield* numeric(options, "end"),
    body: yield* required(options, "body"),
    side: options["side"] === "old" ? "old" : "new",
    id: options["id"] ?? randomUUID(),
    at: options["at"] ?? new Date().toISOString(),
  })
  yield* emit({ ok: true, batch })
})

const dispatch = Effect.fn("Main.dispatch")(function* (argv: ReadonlyArray<string>) {
  const name = argv[0] ?? ""
  const options = optionsFrom(argv.slice(1))
  if (name === "branches") return yield* branchesCommand(options)
  if (name === "comment") return yield* commentCommand(options)
  return yield* new UnknownCommand({ name })
})

const argv = process.argv.slice(2)
const root = process.env["ADIFF_ROOT"] ?? defaultRoot()
const layer = Layer.mergeAll(GitLive, storeAt(root))

const exit = await Effect.runPromiseExit(dispatch(argv).pipe(Effect.provide(layer)))

if (Exit.isFailure(exit)) {
  const failure = Cause.squash(exit.cause)
  process.stdout.write(`${JSON.stringify({ ok: false, error: failure })}\n`)
  process.exitCode = 1
}
