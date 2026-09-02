import { execFile, type ChildProcess } from "node:child_process"
import { Context, Effect, Layer, Option, Schema, absurd } from "effect"
import { ForgeUnavailable } from "./error.ts"

export type PullState = "open" | "draft" | "merged" | "closed"

export type Pull = {
  readonly branch: string
  readonly state: PullState
}

export type ForgeComment = {
  readonly path: string
  readonly start: number
  readonly line: number
  readonly side: "old" | "new"
  readonly body: string
}

export type Sent = {
  readonly landed: ReadonlyArray<number>
  readonly url: string
}

export type ForgeSaid = {
  readonly by: string
  readonly body: string
}

export type ForgeRemark = {
  readonly id: string
  readonly answerTo: number
  readonly replies: ReadonlyArray<ForgeSaid>
  readonly path: string
  readonly side: "old" | "new"
  readonly line: number
  readonly start: number
  readonly by: string
  readonly body: string
  readonly moreReplies: number
  readonly hunk: string
  readonly commit: string
  readonly outdated: boolean
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
  readonly remarks: (
    repo: string,
    branch: string,
  ) => Effect.Effect<ReadonlyArray<ForgeRemark>, ForgeUnavailable>
  readonly answer: (
    repo: string,
    branch: string,
    answerTo: number,
    body: string,
  ) => Effect.Effect<void, ForgeUnavailable>
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

const SAID: ReadonlyArray<"OPEN" | "MERGED" | "CLOSED"> = ["OPEN", "MERGED", "CLOSED"]

const stateOf = (row: typeof Row.Type): PullState => {
  const said = SAID.find((known) => known === row.state)
  switch (said) {
    case "OPEN":
      return row.isDraft ? "draft" : "open"
    case "MERGED":
      return "merged"
    case "CLOSED":
      return "closed"
    case undefined:
      return "open"
    default:
      return absurd(said)
  }
}

const ended = (child: ChildProcess): Effect.Effect<void> => Effect.sync(() => void child.kill())

const ask = (repo: string): Effect.Effect<string, ForgeUnavailable> =>
  Effect.callback<string, ForgeUnavailable>((resume) => {
    const child = execFile(
      "gh",
      ["pr", "list", "--state", "all", "--limit", LIMIT, "--json", FIELDS],
      { cwd: repo, timeout: TIMEOUT_MS, encoding: "utf8" },
      (error, stdout) => {
        if (error === null) return resume(Effect.succeed(stdout))
        resume(Effect.fail(new ForgeUnavailable({ repo, reason: error.message })))
      },
    )
    return ended(child)
  })

const show = (repo: string, branch: string): Effect.Effect<void, ForgeUnavailable> =>
  Effect.callback<void, ForgeUnavailable>((resume) => {
    const child = execFile(
      "gh",
      ["pr", "view", branch, "--web"],
      { cwd: repo, timeout: TIMEOUT_MS, encoding: "utf8" },
      (error) => {
        if (error === null) return resume(Effect.void)
        resume(Effect.fail(new ForgeUnavailable({ repo, reason: error.message })))
      },
    )
    return ended(child)
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
    return ended(child)
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

const sideName = (side: ForgeComment["side"]): string => (side === "old" ? "LEFT" : "RIGHT")

const commentBody = (one: ForgeComment): Record<string, unknown> => ({
  path: one.path,
  line: one.line,
  side: sideName(one.side),
  body: one.body,
  ...(one.start < one.line ? { start_line: one.start, start_side: sideName(one.side) } : {}),
})

const bodyFor = (comments: ReadonlyArray<ForgeComment>): string =>
  JSON.stringify({ event: "COMMENT", comments: comments.map(commentBody) })

const Landed = Schema.Struct({
  comments: Schema.optionalKey(
    Schema.Array(Schema.Struct({ path: Schema.String, line: Schema.optionalKey(Schema.Int) })),
  ),
})

const readLanded = Schema.decodeUnknownOption(Landed)

const jsonOf = Option.liftThrowable((raw: string): unknown => JSON.parse(raw))

type Acknowledged = { readonly path: string; readonly line?: number }

const keyOf = (path: string, line: number): string => `${path}:${line}`

const counted = (back: ReadonlyArray<Acknowledged>): Map<string, number> => {
  const room = new Map<string, number>()
  back.forEach((one) => {
    const key = keyOf(one.path, one.line ?? 0)
    room.set(key, (room.get(key) ?? 0) + 1)
  })
  return room
}

const acknowledged = (said: string): ReadonlyArray<Acknowledged> | undefined =>
  Option.getOrUndefined(Option.flatMap(jsonOf(said), readLanded))?.comments

const landedIn = (said: string, asked: ReadonlyArray<ForgeComment>): ReadonlyArray<number> => {
  const back = acknowledged(said)
  if (back === undefined) return []
  const room = counted(back)
  return asked.flatMap((one, at) => {
    const key = keyOf(one.path, one.line)
    const left = room.get(key) ?? 0
    if (left === 0) return []
    room.set(key, left - 1)
    return [at]
  })
}

const THREADS = `query($owner:String!,$name:String!,$branch:String!,$after:String){
  repository(owner:$owner,name:$name){
    pullRequests(headRefName:$branch,first:1,orderBy:{field:CREATED_AT,direction:DESC}){
      nodes{
        reviewThreads(first:50,after:$after){
          pageInfo{ hasNextPage endCursor }
          nodes{
            id isResolved isOutdated path diffSide
            line originalLine startLine originalStartLine
            comments(first:50){
              totalCount
              nodes{ databaseId author{login} body diffHunk originalCommit{oid} }
            }
          }
        }
      }
    }
  }
}`

const Said = Schema.Struct({
  databaseId: Schema.optionalKey(Schema.NullishOr(Schema.Int)),
  author: Schema.optionalKey(Schema.NullishOr(Schema.Struct({ login: Schema.String }))),
  body: Schema.String,
  diffHunk: Schema.optionalKey(Schema.NullishOr(Schema.String)),
  originalCommit: Schema.optionalKey(Schema.NullishOr(Schema.Struct({ oid: Schema.String }))),
})

const Thread = Schema.Struct({
  id: Schema.String,
  isResolved: Schema.Boolean,
  isOutdated: Schema.Boolean,
  path: Schema.String,
  line: Schema.optionalKey(Schema.NullishOr(Schema.Int)),
  originalLine: Schema.optionalKey(Schema.NullishOr(Schema.Int)),
  startLine: Schema.optionalKey(Schema.NullishOr(Schema.Int)),
  originalStartLine: Schema.optionalKey(Schema.NullishOr(Schema.Int)),
  diffSide: Schema.String,
  comments: Schema.Struct({
    totalCount: Schema.optionalKey(Schema.NullishOr(Schema.Int)),
    nodes: Schema.Array(Said),
  }),
})

const Page = Schema.Struct({
  hasNextPage: Schema.Boolean,
  endCursor: Schema.optionalKey(Schema.NullishOr(Schema.String)),
})

const Held = Schema.Struct({
  reviewThreads: Schema.Struct({
    pageInfo: Schema.optionalKey(Page),
    nodes: Schema.Array(Thread),
  }),
})

const Threads = Schema.Struct({
  data: Schema.Struct({
    repository: Schema.Struct({
      pullRequests: Schema.Struct({
        nodes: Schema.Array(Held),
      }),
    }),
  }),
})

const readThreads = Schema.decodeUnknownEffect(Threads)

const ANONYMOUS = "someone"

const heardFrom = (said: typeof Said.Type): ForgeSaid => ({
  by: said.author?.login ?? ANONYMOUS,
  body: said.body,
})

const someLine = (...found: ReadonlyArray<number | null | undefined>): number | undefined =>
  found.find((one) => one !== null && one !== undefined) ?? undefined

const hasNoLine = (thread: typeof Thread.Type): boolean =>
  thread.line === null || thread.line === undefined

const quotedIn = (said: typeof Said.Type): { readonly hunk: string; readonly commit: string } => ({
  hunk: said.diffHunk ?? "",
  commit: said.originalCommit?.oid ?? "",
})

const spanIn = (
  thread: typeof Thread.Type,
  line: number,
): { readonly line: number; readonly start: number } => ({
  line,
  start: someLine(thread.startLine, thread.originalStartLine) ?? line,
})

const remarkOf = (thread: typeof Thread.Type): ForgeRemark | undefined => {
  const [first, ...rest] = thread.comments.nodes
  const line = someLine(thread.line, thread.originalLine)
  if (first === undefined || line === undefined) return undefined
  return {
    id: thread.id,
    answerTo: first.databaseId ?? 0,
    moreReplies: Math.max(0, (thread.comments.totalCount ?? 0) - thread.comments.nodes.length),
    path: thread.path,
    side: thread.diffSide === "LEFT" ? "old" : "new",
    ...spanIn(thread, line),
    ...heardFrom(first),
    ...quotedIn(first),
    replies: rest.map(heardFrom),
    outdated: thread.isOutdated || hasNoLine(thread),
  }
}

const ownerOf = Effect.fn("Forge.owner")(function* (repo: string) {
  const said = yield* gh(repo, ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
  const [owner = "", name = ""] = said.trim().split("/")
  return { owner, name }
})

type Where = { readonly owner: string; readonly name: string; readonly number: number }

const HERE: ReadonlyArray<string> = ["-F", "owner={owner}", "-F", "name={repo}"]

const asked = (repo: string, branch: string, after: string | undefined) =>
  gh(repo, [
    "api",
    "graphql",
    "-f",
    `query=${THREADS}`,
    ...HERE,
    "-f",
    `branch=${branch}`,
    ...(after === undefined ? [] : ["-f", `after=${after}`]),
  ])

const whereOf = Effect.fn("Forge.whereOf")(function* (repo: string, branch: string) {
  const pull = yield* named(repo, branch)
  const here = yield* ownerOf(repo)
  return { owner: here.owner, name: here.name, number: pull.number } satisfies Where
})

const threadsIn = Effect.fn("Forge.threadsIn")(function* (repo: string, raw: string) {
  const parsed = yield* Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) => new ForgeUnavailable({ repo, reason: String(cause) }),
  })
  const held = yield* Effect.mapError(
    readThreads(parsed),
    (cause) => new ForgeUnavailable({ repo, reason: String(cause) }),
  )
  return held.data.repository.pullRequests.nodes[0]?.reviewThreads
})

const unresolved = (nodes: ReadonlyArray<typeof Thread.Type>): ReadonlyArray<ForgeRemark> =>
  nodes
    .filter((thread) => !thread.isResolved)
    .flatMap((thread) => {
      const found = remarkOf(thread)
      return found === undefined ? [] : [found]
    })

const PAGES = 20

const everyThread = Effect.fn("Forge.everyThread")(function* (repo: string, branch: string) {
  const held: Array<typeof Thread.Type> = []
  let after: string | undefined
  for (let page = 0; page < PAGES; page += 1) {
    const raw: string = yield* asked(repo, branch, after)
    const found: typeof Held.Type["reviewThreads"] | undefined = yield* threadsIn(repo, raw)
    if (found === undefined) return held
    held.push(...found.nodes)
    if (found.pageInfo?.hasNextPage !== true) return held
    const next = found.pageInfo.endCursor
    if (next === null || next === undefined) return held
    after = next
  }
  return held
})

const answer = Effect.fn("Forge.answer")(function* (
  repo: string,
  branch: string,
  answerTo: number,
  body: string,
) {
  const where = yield* whereOf(repo, branch)
  const route = `repos/${where.owner}/${where.name}/pulls/${where.number}/comments`
  const said = yield* gh(
    repo,
    ["api", "--method", "POST", route, "--input", "-"],
    JSON.stringify({ body, in_reply_to: answerTo }),
  )
  const landed = yield* Effect.try({
    try: () => JSON.parse(said) as { readonly id?: number },
    catch: (cause) => new ForgeUnavailable({ repo, reason: String(cause) }),
  })
  return yield* landed.id === undefined
    ? new ForgeUnavailable({ repo, reason: "the reply came back with no id" })
    : Effect.void
})

const remarks = Effect.fn("Forge.remarks")(function* (repo: string, branch: string) {
  return unresolved(yield* everyThread(repo, branch))
})

const review = Effect.fn("Forge.review")(function* (
  repo: string,
  branch: string,
  comments: ReadonlyArray<ForgeComment>,
) {
  const pull = yield* named(repo, branch)
  const owner = yield* gh(repo, ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"])
  const route = `repos/${owner.trim()}/pulls/${pull.number}/reviews`
  const said = yield* gh(repo, ["api", "--method", "POST", route, "--input", "-"], bodyFor(comments))
  return { landed: landedIn(said, comments), url: pull.url }
})

export const ForgeLive: Layer.Layer<Forge> = Layer.succeed(Forge)({
  pulls,
  openPull,
  head,
  review,
  remarks,
  answer,
})
