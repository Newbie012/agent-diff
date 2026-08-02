import { randomUUID } from "node:crypto"
import { Cause, Effect, Exit, Layer } from "effect"
import {
  awaitComments,
  catalog,
  commandNames,
  failure,
  fieldsOf,
  findCommand,
  listBranches,
  narrow,
  numeric,
  optionsFrom,
  required,
  reviewProgress,
  submitComment,
  takeComments,
  toggleVouch,
  UnknownCommand,
  type Options,
} from "./cli/index.ts"
import { GitLive } from "./service/git/index.ts"
import { runTui } from "./tui/index.ts"
import { storeAt, defaultRoot } from "./service/store/index.ts"

const WAIT_UNIT = 1000

const answer = (options: Options, body: Record<string, unknown>): Effect.Effect<void> =>
  Effect.sync(() => {
    const fields = fieldsOf(options)
    const narrowed = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, narrow(value, fields)]),
    )
    process.stdout.write(`${JSON.stringify({ ok: true, ...narrowed })}\n`)
  })

const branchList = Effect.fn("Main.branchList")(function* (options: Options) {
  const branches = yield* listBranches(yield* required(options, "repo"))
  yield* answer(options, { branches })
})

const commentAdd = Effect.fn("Main.commentAdd")(function* (options: Options) {
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
  yield* answer(options, { batch })
})

const commentTake = Effect.fn("Main.commentTake")(function* (options: Options) {
  const worktree = yield* required(options, "worktree")
  const wait = Number(options["wait"] ?? 0)
  const comments =
    wait > 0
      ? yield* awaitComments(worktree, Date.now() + wait * WAIT_UNIT)
      : yield* takeComments(worktree)
  yield* answer(options, { comments })
})

const fileVouch = Effect.fn("Main.fileVouch")(function* (options: Options) {
  const report = yield* toggleVouch({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    file: yield* required(options, "file"),
  })
  yield* answer(options, { vouched: report.vouched, total: report.total })
})

const reviewStatus = Effect.fn("Main.reviewStatus")(function* (options: Options) {
  const report = yield* reviewProgress(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
  )
  yield* answer(options, { vouched: report.vouched, total: report.total })
})

const describe = Effect.fn("Main.describe")(function* (options: Options) {
  const wanted = options["command"]
  const asked = wanted === undefined || wanted === "true" ? undefined : wanted
  const found = asked === undefined ? undefined : findCommand(asked)
  if (asked !== undefined && found === undefined) {
    return yield* new UnknownCommand({ name: asked, known: commandNames })
  }
  yield* answer(options, { commands: found === undefined ? catalog : [found] })
})

const run = Effect.fn("Main.run")(function* (name: string, options: Options) {
  if (name === "branch list") return yield* branchList(options)
  if (name === "comment add") return yield* commentAdd(options)
  if (name === "comment take") return yield* commentTake(options)
  if (name === "file vouch") return yield* fileVouch(options)
  if (name === "review progress") return yield* reviewStatus(options)
  if (name === "review open") return yield* runTui(yield* required(options, "repo"))
  if (name === "describe") return yield* describe(options)
  return yield* new UnknownCommand({ name, known: commandNames })
})

const nameOf = (argv: ReadonlyArray<string>): string => {
  const words = argv.filter((token) => !token.startsWith("--"))
  const pair = words.slice(0, 2).join(" ")
  return findCommand(pair) === undefined ? (words[0] ?? "") : pair
}

const argv = process.argv.slice(2)
const layer = Layer.mergeAll(GitLive, storeAt(process.env["ADIFF_ROOT"] ?? defaultRoot()))
const exit = await Effect.runPromiseExit(
  run(nameOf(argv), optionsFrom(argv)).pipe(Effect.provide(layer)),
)

if (Exit.isFailure(exit)) {
  const reported = failure(Cause.squash(exit.cause))
  process.stderr.write(`${reported.line}\n`)
  process.exitCode = reported.exit
}
