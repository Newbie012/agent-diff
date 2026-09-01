import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"
import { text as readStream } from "node:stream/consumers"
import { Cause, Effect, Layer } from "effect"
import {
  addDraft,
  dispatchDrafts,
  dropDraft,
  editDraft,
  listDrafts,
  answerComment,
  addressing,
  awaitComments,
  branchAt,
  catalog,
  knownIn,
  valuedIn,
  failure,
  fieldsOf,
  findCommand,
  findUpgrade,
  openPane,
  listBranches,
  setBase,
  clearBase,
  listThreads,
  listRemarks,
  acceptRemark,
  answerRemark,
  dismissRemark,
  restoreRemark,
  MalformedLayers,
  MissingOption,
  narrow,
  strangeField,
  nearestCommand,
  numeric,
  oneOf,
  onlyKnown,
  optionsFrom,
  required,
  seconds,
  verbsUnder,
  reviewProgress,
  removeComment,
  repoOf,
  restoreComment,
  unsettleThread,
  runUpgrade,
  type UpgradeFound,
  sayDone,
  SAY_SKILL_TOO,
  sayFound,
  settleThread,
  setLayers,
  showLayers,
  readPreference,
  readPreferences,
  preferenceValue,
  savePreference,
  submitComment,
  submitReply,
  takeComments,
  toggleVouch,
  worktreeOf,
  UnknownCommand,
  UnknownField,
  upgradeReport,
  willUpgrade,
  type Options,
  lastOpenedIn,
} from "./cli/index.ts"
import { banner, help, helpFor, helpUnder, usageOf, version } from "./cli/help.ts"
import { GitLive } from "./service/git/index.ts"
import { ForgeLive } from "./service/forge/index.ts"
import { storeAt, defaultRoot } from "./service/store/index.ts"

const WAIT_UNIT = 1000

const answer = (
  options: Options,
  body: Record<string, unknown>,
): Effect.Effect<void, UnknownField> => {
  const fields = fieldsOf(options)
  const strange = strangeField(body, fields)
  if (strange !== undefined) return Effect.fail(new UnknownField(strange))
  return Effect.sync(() => {
    const narrowed = Object.fromEntries(
      Object.entries(body).map(([key, value]) => [key, narrow(value, fields)]),
    )
    process.stdout.write(`${JSON.stringify({ ok: true, ...narrowed })}\n`)
  })
}

const branchList = Effect.fn("Main.branchList")(function* (options: Options) {
  const branches = yield* listBranches(yield* required(options, "repo"), options["base"])
  yield* answer(options, { branches })
})

const baseSet = Effect.fn("Main.baseSet")(function* (options: Options) {
  const report = yield* setBase(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "base"),
  )
  yield* answer(options, { base: report })
})

const baseClear = Effect.fn("Main.baseClear")(function* (options: Options) {
  const report = yield* clearBase(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
  )
  yield* answer(options, { base: report })
})

const commentSend = Effect.fn("Main.commentSend")(function* (options: Options) {
  const batch = yield* submitComment({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    file: yield* required(options, "file"),
    start: yield* numeric(options, "start"),
    end: yield* numeric(options, "end"),
    body: yield* required(options, "body"),
    side: yield* oneOf(options, "side", ["old", "new"] as const, "new"),
    id: options["id"] ?? randomUUID(),
    at: options["at"] ?? new Date().toISOString(),
  })
  yield* answer(options, { batch })
})

const draftList = Effect.fn("Main.draftList")(function* (options: Options) {
  const drafts = yield* listDrafts(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
  )
  yield* answer(options, { drafts })
})

const draftAdd = Effect.fn("Main.draftAdd")(function* (options: Options) {
  const draft = yield* addDraft({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    file: yield* required(options, "file"),
    start: yield* numeric(options, "start"),
    end: yield* numeric(options, "end"),
    body: yield* required(options, "body"),
    side: yield* oneOf(options, "side", ["old", "new"] as const, "new"),
    id: options["id"] ?? randomUUID(),
    at: options["at"] ?? new Date().toISOString(),
    wroteBy: "agent",
  })
  yield* answer(options, { draft })
})

const draftEdit = Effect.fn("Main.draftEdit")(function* (options: Options) {
  const draft = yield* editDraft(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
    yield* required(options, "body"),
  )
  yield* answer(options, { draft })
})

const draftDrop = Effect.fn("Main.draftDrop")(function* (options: Options) {
  const dropped = yield* dropDraft(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
  )
  yield* answer(options, { dropped })
})

const draftSend = Effect.fn("Main.draftSend")(function* (options: Options) {
  const dispatched = yield* dispatchDrafts(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
  )
  yield* answer(options, { dispatched })
})

const commentReply = Effect.fn("Main.commentReply")(function* (options: Options) {
  const batch = yield* submitReply({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    to: yield* required(options, "to"),
    body: yield* required(options, "body"),
    id: options["id"] ?? randomUUID(),
    at: options["at"] ?? new Date().toISOString(),
  })
  yield* answer(options, { batch })
})

const NOTHING_WAITING =
  "No comment is waiting. Pass --wait <seconds> to block until one arrives, and answer what you collect with `adiff comment answer --worktree . --id <id> --body '…'`."

const commentTake = Effect.fn("Main.commentTake")(function* (options: Options) {
  const worktree = yield* required(options, "worktree")
  const wait = yield* seconds(options, "wait")
  const comments =
    wait > 0
      ? yield* awaitComments(worktree, Date.now() + wait * WAIT_UNIT)
      : yield* takeComments(worktree)
  const hint = comments.length === 0 ? { hint: NOTHING_WAITING } : {}
  yield* answer(options, { comments, branch: yield* branchAt(worktree), ...hint })
})

const commentAnswer = Effect.fn("Main.commentAnswer")(function* (options: Options) {
  const report = yield* answerComment({
    worktree: yield* required(options, "worktree"),
    id: yield* required(options, "id"),
    body: yield* required(options, "body"),
    asks: options["question"] !== undefined,
    at: options["at"] ?? new Date().toISOString(),
  })
  yield* answer(options, { answered: report.answered })
})

const remarkList = Effect.fn("Main.remarkList")(function* (options: Options) {
  const remarks = yield* listRemarks(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
  )
  yield* answer(options, { remarks })
})

const remarkAccept = Effect.fn("Main.remarkAccept")(function* (options: Options) {
  const report = yield* acceptRemark({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    id: yield* required(options, "id"),
    body: options["body"],
    at: options["at"] ?? new Date().toISOString(),
    commentId: options["comment"] ?? randomUUID(),
  })
  yield* answer(options, report)
})

const remarkReply = Effect.fn("Main.remarkReply")(function* (options: Options) {
  const report = yield* answerRemark({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    id: yield* required(options, "id"),
    body: yield* required(options, "body"),
  })
  yield* answer(options, { answered: report.answered })
})

const remarkDismiss = Effect.fn("Main.remarkDismiss")(function* (options: Options) {
  const report = yield* dismissRemark(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
    options["at"] ?? new Date().toISOString(),
  )
  yield* answer(options, { dismissed: report.dismissed })
})

const remarkRestore = Effect.fn("Main.remarkRestore")(function* (options: Options) {
  const report = yield* restoreRemark(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
  )
  yield* answer(options, { restored: report.restored })
})

const commentList = Effect.fn("Main.commentList")(function* (options: Options) {
  const comments = yield* listThreads(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
  )
  yield* answer(options, { comments })
})

const commentResolve = Effect.fn("Main.commentResolve")(function* (options: Options) {
  const report = yield* settleThread(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
    options["at"] ?? new Date().toISOString(),
  )
  yield* answer(options, { settled: report.settled })
})

const commentRemove = Effect.fn("Main.commentRemove")(function* (options: Options) {
  const report = yield* removeComment(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
    options["at"] ?? new Date().toISOString(),
  )
  yield* answer(options, { removed: report.removed })
})

const commentRestore = Effect.fn("Main.commentRestore")(function* (options: Options) {
  const report = yield* restoreComment(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
  )
  yield* answer(options, { restored: report.restored })
})

const commentReopen = Effect.fn("Main.commentReopen")(function* (options: Options) {
  const report = yield* unsettleThread(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    yield* required(options, "id"),
  )
  yield* answer(options, { reopened: report.unsettled })
})

const fileReview = Effect.fn("Main.fileReview")(function* (options: Options) {
  const report = yield* toggleVouch({
    repo: yield* required(options, "repo"),
    branch: yield* required(options, "branch"),
    file: yield* required(options, "file"),
  })
  yield* answer(options, { reviewed: report.vouched, total: report.total })
})

const reviewStatus = Effect.fn("Main.reviewStatus")(function* (options: Options) {
  const report = yield* reviewProgress(
    yield* required(options, "repo"),
    yield* required(options, "branch"),
    options["base"],
  )
  yield* answer(options, { reviewed: report.vouched, total: report.total })
})

const documentAt = Effect.fn("Main.documentAt")(function* (source: string) {
  return yield* Effect.tryPromise({
    try: () => (source === "-" ? readStream(process.stdin) : readFile(source, "utf8")),
    catch: (cause) => new MalformedLayers({ reason: String(cause) }),
  })
})

const layersSet = Effect.fn("Main.layersSet")(function* (options: Options) {
  const document = yield* documentAt(yield* required(options, "json"))
  const layers = yield* setLayers(
    yield* required(options, "worktree"),
    document,
    options["at"] ?? new Date().toISOString(),
  )
  yield* answer(options, { layers })
})

const layersShow = Effect.fn("Main.layersShow")(function* (options: Options) {
  const layers = yield* showLayers(yield* required(options, "worktree"))
  yield* answer(options, { layers })
})

const configList = Effect.fn("Main.configList")(function* (options: Options) {
  yield* answer(options, { preferences: yield* readPreferences() })
})

const configGet = Effect.fn("Main.configGet")(function* (options: Options) {
  const preference = yield* readPreference(yield* required(options, "name"))
  yield* answer(options, { preference })
})

const configSet = Effect.fn("Main.configSet")(function* (options: Options) {
  const name = yield* required(options, "name")
  const wanted = yield* preferenceValue(name, yield* required(options, "value"))
  yield* answer(options, { preference: yield* savePreference(name, wanted) })
})

const reviewPane = Effect.fn("Main.reviewPane")(function* (options: Options) {
  const report = yield* openPane(
    yield* required(options, "repo"),
    options["branch"],
    options["base"],
  )
  yield* answer(options, { opened: report.opened, pane: report.pane, command: report.command })
})

const say = (line: string): Effect.Effect<void> =>
  Effect.sync(() => process.stdout.write(line))

const settledUpgrade = (found: UpgradeFound, check: boolean, ran: boolean): Effect.Effect<void> =>
  Effect.sync(() => {
    if (check || found.current === true || ran) return
    process.exitCode = 1
  })

const saidUpgrade = Effect.fn("Main.saidUpgrade")(function* (
  found: UpgradeFound,
  ran: boolean,
) {
  yield* say(`\n${sayDone(found, ran)}\n`)
  yield* say(`${SAY_SKILL_TOO}\n`)
})

const upgrade = Effect.fn("Main.upgrade")(function* (options: Options) {
  const check = options["check"] !== undefined
  const quiet = options["json"] !== undefined
  const found = yield* findUpgrade
  const upgrading = willUpgrade(found, check)
  if (!quiet) yield* say(`${sayFound(found, check)}\n${upgrading ? "\n" : ""}`)
  const ran = upgrading ? yield* runUpgrade(found, quiet) : false
  if (quiet) {
    return yield* answer(options, { upgrade: upgradeReport(found, ran, check) })
  }
  if (upgrading) yield* saidUpgrade(found, ran)
  return yield* settledUpgrade(found, check, ran)
})

const describe = Effect.fn("Main.describe")(function* (options: Options) {
  const wanted = options["command"]
  const asked = wanted === undefined || wanted === "true" ? undefined : wanted
  const found = asked === undefined ? undefined : findCommand(asked)
  if (asked !== undefined && found === undefined) {
    return yield* unknown(asked)
  }
  return yield* answer(options, { commands: found === undefined ? catalog : [found] })
})

const routes = {
  "branch list": branchList,
  "base set": baseSet,
  "base clear": baseClear,
  "comment send": commentSend,
  "comment reply": commentReply,
  "comment take": commentTake,
  "comment answer": commentAnswer,
  "comment list": commentList,
  "remark list": remarkList,
  "remark accept": remarkAccept,
  "remark reply": remarkReply,
  "remark dismiss": remarkDismiss,
  "remark restore": remarkRestore,
  "draft list": draftList,
  "draft add": draftAdd,
  "draft edit": draftEdit,
  "draft drop": draftDrop,
  "draft send": draftSend,
  "comment resolve": commentResolve,
  "comment remove": commentRemove,
  "comment restore": commentRestore,
  "comment reopen": commentReopen,
  "config list": configList,
  "config get": configGet,
  "config set": configSet,
  "review pane": reviewPane,
  "review progress": reviewStatus,
  "layers set": layersSet,
  "layers show": layersShow,
  upgrade,
  describe,
} as const

const unknown = (name: string): UnknownCommand => {
  const verbs = verbsUnder(name)
  if (verbs.length > 0) return new UnknownCommand({ name, verbs })
  const didYouMean = nearestCommand(name)
  return didYouMean === undefined
    ? new UnknownCommand({ name })
    : new UnknownCommand({ name, didYouMean })
}

const byBranch = Effect.fn("Main.byBranch")(function* (options: Options, repo: string, branch: string) {
  return options["worktree"] !== undefined
    ? options
    : { ...options, worktree: yield* worktreeOf(repo, branch) }
})

const byWorktree = Effect.fn("Main.byWorktree")(function* (options: Options, worktree: string) {
  const found: Options = {
    ...options,
    repo: yield* repoOf(worktree),
    branch: yield* branchAt(worktree),
  }
  return found
})

const addressOf = Effect.fn("Main.addressOf")(function* (name: string, options: Options) {
  if (findCommand(name)?.addresses !== "review") return options
  const repo = options["repo"]
  const branch = options["branch"]
  if (repo !== undefined && branch !== undefined) return yield* byBranch(options, repo, branch)
  const worktree = options["worktree"]
  if (worktree !== undefined) return yield* byWorktree(options, worktree)
  return yield* new MissingOption({ option: addressing[0]?.name ?? "worktree" })
})

const RESUME_ADVICE = "Nothing has been opened here yet. Run `adiff review open --repo .` and pick a branch."

const resume = Effect.fn("Main.resume")(function* (options: Options) {
  const repo = options["repo"] ?? process.cwd()
  const found = yield* lastOpenedIn(repo)
  if (options["check"] !== undefined) {
    return yield* answer(options, {
      resume: found === undefined ? {} : found,
      advice: found === undefined ? RESUME_ADVICE : "",
    })
  }
  if (found === undefined) {
    process.stderr.write(`${RESUME_ADVICE}\n`)
    return yield* Effect.sync(() => process.exit(3))
  }
  const { runTui } = yield* Effect.promise(() => import("./tui/index.ts"))
  return yield* runTui(repo, {
    sessionPath: process.env["ADIFF_SESSION"],
    branch: found.branch,
    base: options["base"],
  })
})

const dispatch = Effect.fn("Main.dispatch")(function* (name: string, given: Options) {
  const options = yield* addressOf(name, given)
  const route = Object.hasOwn(routes, name) ? routes[name as keyof typeof routes] : undefined
  if (route !== undefined) return yield* route(options)
  if (name === "file review") return yield* fileReview(options)
  if (name === "resume") return yield* resume(options)
  if (name === "review open") {
    const { runTui } = yield* Effect.promise(() => import("./tui/index.ts"))
    return yield* runTui(yield* required(options, "repo"), {
      sessionPath: process.env["ADIFF_SESSION"],
      branch: options["branch"],
      base: options["base"],
    })
  }
  return yield* unknown(name)
})

const wanting = (name: string) => (error: MissingOption) => {
  const command = findCommand(name)
  return command === undefined
    ? Effect.fail(error)
    : Effect.fail(
        new MissingOption({ option: error.option, command: command.name, usage: usageOf(command) }),
      )
}

const run = (name: string, options: Options) =>
  onlyKnown(options, knownIn(name)).pipe(
    Effect.flatMap(() => dispatch(name, options)),
    Effect.catchTag("MissingOption", wanting(name)),
  )

const leading = (argv: ReadonlyArray<string>): ReadonlyArray<string> => {
  const stop = argv.findIndex((token) => token.startsWith("-"))
  return stop === -1 ? argv : argv.slice(0, stop)
}

const nameOf = (argv: ReadonlyArray<string>): string => {
  const words = leading(argv)
  const pair = words.slice(0, 2).join(" ")
  if (findCommand(pair) !== undefined) return pair
  return words.length > 1 ? pair : (words[0] ?? "")
}

const argv = process.argv.slice(2)

const ASKS: Readonly<Record<string, () => string>> = {
  "--version": version,
  "-v": version,
  "--help": help,
  "-h": help,
}

const about = (words: ReadonlyArray<string>): string => {
  const noun = words[0] ?? ""
  return helpFor(words.slice(0, 2).join(" ")) ?? helpUnder(noun) ?? help()
}

const spoken = (given: ReadonlyArray<string>): string | undefined => {
  const words = leading(given)
  if (words.length === 0) {
    const asked = ASKS[given[0] ?? ""]
    return asked === undefined ? banner() : asked()
  }
  const [first, ...rest] = words
  if (first === "help") return rest.length === 0 ? help() : about(rest)
  return given.some((token) => token === "--help" || token === "-h") ? about(words) : undefined
}

const watched = (): boolean => process.stdout.isTTY && process.stdin.isTTY

const opening = argv.length === 0 && watched()

const said = opening ? undefined : spoken(argv)
if (said !== undefined) {
  process.stdout.write(`${said}\n`)
  process.exit(0)
}

const layer = Layer.mergeAll(GitLive, ForgeLive, storeAt(process.env["ADIFF_ROOT"] ?? defaultRoot()))

const reportFailure = (cause: Cause.Cause<unknown>): Effect.Effect<void> =>
  Effect.sync(() => {
    const reported = failure(Cause.squash(cause))
    process.stderr.write(`${reported.line}\n`)
    process.exitCode = reported.exit
  })

Effect.runFork(
  run(
    opening ? "review open" : nameOf(argv),
    opening ? { repo: "." } : optionsFrom(argv, valuedIn(nameOf(argv))),
  ).pipe(
    Effect.provide(layer),
    Effect.catchCause(reportFailure),
  ),
)
