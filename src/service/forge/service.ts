import { execFile } from "node:child_process"
import { Context, Effect, Layer, Schema } from "effect"
import { ForgeUnavailable } from "./error.ts"

export type PullState = "open" | "draft" | "merged" | "closed"

export type Pull = {
  readonly branch: string
  readonly state: PullState
}

export type ForgeComment = {
  readonly path: string
  readonly line: number
  readonly side: "old" | "new"
  readonly body: string
}

export type Sent = {
  readonly landed: ReadonlyArray<string>
  readonly url: string
}

export type Shape = {
  readonly pulls: (repo: string) => Effect.Effect<ReadonlyArray<Pull>, ForgeUnavailable>
  readonly openPull: (repo: string, branch: string) => Effect.Effect<void, ForgeUnavailable>
  readonly head: (repo: string, branch: string) => Effect.Effect<string, ForgeUnavailable>
  readonly review: (
    repo: string,
    branch: string,
    comments: ReadonlyArray<ForgeComment>,
  ) => Effect.Effect<Sent, ForgeUnavailable>
}

export class Forge extends Context.Service<Forge, Shape>()("adiff/Forge") {}

const LIMIT = "200"
const TIMEOUT_MS = 4000
const SEND_TIMEOUT_MS = 20_000
const MOST_OUTPUT = 4 * 1024 * 1024
const FIELDS = "headRefName,state,isDraft"

const Row = Schema.Struct({
  headRefName: Schema.String,
  state: Schema.String,
  isDraft: Schema.Boolean,
})

const decode = Schema.decodeUnknownEffect(Schema.Array(Row))

const stateOf = (row: typeof Row.Type): PullState => {
  if (row.isDraft && row.state === "OPEN") return "draft"
  if (row.state === "MERGED") return "merged"
  if (row.state === "CLOSED") return "closed"
  return "open"
}

const ask = (repo: string): Effect.Effect<string, ForgeUnavailable> =>
  Effect.callback<string, ForgeUnavailable>((resume) => {
    execFile(
      "gh",
      ["pr", "list", "--state", "all", "--limit", LIMIT, "--json", FIELDS],
      { cwd: repo, timeout: TIMEOUT_MS, encoding: "utf8" },
      (error, stdout) => {
        if (error === null) return resume(Effect.succeed(stdout))
        resume(Effect.fail(new ForgeUnavailable({ repo, reason: error.message })))
      },
    )
  })

const show = (repo: string, branch: string): Effect.Effect<void, ForgeUnavailable> =>
  Effect.callback<void, ForgeUnavailable>((resume) => {
    execFile(
      "gh",
      ["pr", "view", branch, "--web"],
      { cwd: repo, timeout: TIMEOUT_MS, encoding: "utf8" },
      (error) => {
        if (error === null) return resume(Effect.void)
        resume(Effect.fail(new ForgeUnavailable({ repo, reason: error.message })))
      },
    )
  })

const read = Effect.fn("Forge.read")(function* (repo: string, raw: string) {
  const parsed = yield* Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => new ForgeUnavailable({ repo, reason: String(cause) }),
  })
  const rows = yield* Effect.mapError(
    decode(parsed),
    (cause) => new ForgeUnavailable({ repo, reason: String(cause) }),
  )
  return rows.map((row) => ({ branch: row.headRefName, state: stateOf(row) }))
})

const pulls = Effect.fn("Forge.pulls")(function* (repo: string) {
  const raw = yield* ask(repo)
  return yield* read(repo, raw)
})

const openPull = Effect.fn("Forge.openPull")(function* (repo: string, branch: string) {
  yield* show(repo, branch)
})

const NUMBER_FIELDS = "number,headRefOid,url"

const Named = Schema.Struct({
  number: Schema.Int,
  headRefOid: Schema.String,
  url: Schema.String,
})

const readNamed = Schema.decodeUnknownEffect(Named)

const gh = (
  repo: string,
  args: ReadonlyArray<string>,
  input?: string,
): Effect.Effect<string, ForgeUnavailable> =>
  Effect.callback<string, ForgeUnavailable>((resume) => {
    const child = execFile(
      "gh",
      [...args],
      { cwd: repo, timeout: SEND_TIMEOUT_MS, encoding: "utf8", maxBuffer: MOST_OUTPUT },
      (error, stdout, stderr) => {
        if (error === null) return resume(Effect.succeed(stdout))
        const said = stderr.trim().length > 0 ? stderr.trim() : error.message
        resume(Effect.fail(new ForgeUnavailable({ repo, reason: said })))
      },
    )
    if (input !== undefined) {
      child.stdin?.end(input)
    }
  })

const named = Effect.fn("Forge.named")(function* (repo: string, branch: string) {
  const raw = yield* gh(repo, ["pr", "view", branch, "--json", NUMBER_FIELDS])
  const parsed = yield* Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => new ForgeUnavailable({ repo, reason: String(cause) }),
  })
  return yield* Effect.mapError(
    readNamed(parsed),
    (cause) => new ForgeUnavailable({ repo, reason: String(cause) }),
  )
})

const head = Effect.fn("Forge.head")(function* (repo: string, branch: string) {
  return (yield* named(repo, branch)).headRefOid
})

const bodyFor = (comments: ReadonlyArray<ForgeComment>): string =>
  JSON.stringify({
    event: "COMMENT",
    comments: comments.map((one) => ({
      path: one.path,
      line: one.line,
      side: one.side === "old" ? "LEFT" : "RIGHT",
      body: one.body,
    })),
  })

const review = Effect.fn("Forge.review")(function* (
  repo: string,
  branch: string,
  comments: ReadonlyArray<ForgeComment>,
) {
  const pull = yield* named(repo, branch)
  const owner = yield* gh(repo, ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
  const route = `repos/${owner.trim()}/pulls/${pull.number}/reviews`
  yield* gh(repo, ["api", "--method", "POST", route, "--input", "-"], bodyFor(comments))
  return { landed: comments.map((one) => `${one.path}:${one.line}`), url: pull.url }
})

export const ForgeLive: Layer.Layer<Forge> = Layer.succeed(Forge)({
  pulls,
  openPull,
  head,
  review,
})
