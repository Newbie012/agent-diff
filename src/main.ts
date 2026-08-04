import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { text as readStream } from "node:stream/consumers"
import { Cause, Effect, Exit, Layer } from "effect"
import {
  awaitComments,
  catalog,
  commandNames,
  failure,
  fieldsOf,
  findCommand,
  listBranches,
  MalformedStory,
  narrow,
  numeric,
  optionsFrom,
  required,
  reviewProgress,
  setStory,
  showStory,
  stageComment,
  submitComment,
  submitReview,
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

const commentStage = Effect.fn("Main.commentStage")(function* (options: Options) {
  const report = yield* stageComment({
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
  yield* answer(options, { pending: report.pending })
})

const reviewSubmit = Effect.fn("Main.reviewSubmit")(function* (options: Options) {
  const report = yield* submitReview(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    options["id"] ?? randomUUID(),
    options["at"] ?? new Date().toISOString(),
  )
  yield* answer(options, { submitted: report.submitted })
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
  yield* answer(options, { vouched: report.vouched, total: report.total, pending: report.pending })
})

const documentAt = Effect.fn("Main.documentAt")(function* (source: string) {
  return yield* Effect.tryPromise({
    try: () => (source === "-" ? readStream(process.stdin) : readFile(source, "utf8")),
    catch: (cause) => new MalformedStory({ reason: String(cause) }),
  })
})

const storySet = Effect.fn("Main.storySet")(function* (options: Options) {
  const document = yield* documentAt(yield* required(options, "json"))
  const story = yield* setStory(
    yield* required(options, "worktree"),
    document,
    options["at"] ?? new Date().toISOString(),
  )
  yield* answer(options, { story })
})

const storyShow = Effect.fn("Main.storyShow")(function* (options: Options) {
  const story = yield* showStory(yield* required(options, "worktree"))
  yield* answer(options, { story })
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

const routes = {
  "branch list": branchList,
  "comment add": commentAdd,
  "comment stage": commentStage,
  "comment take": commentTake,
  "review submit": reviewSubmit,
  "review progress": reviewStatus,
  "story set": storySet,
  "story show": storyShow,
  describe,
} as const

const run = Effect.fn("Main.run")(function* (name: string, options: Options) {
  const route = Object.hasOwn(routes, name) ? routes[name as keyof typeof routes] : undefined
  if (route !== undefined) return yield* route(options)
  if (name === "file vouch") return yield* fileVouch(options)
  if (name === "review open") {
    return yield* runTui(yield* required(options, "repo"), process.env["ADIFF_SESSION"])
  }
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
