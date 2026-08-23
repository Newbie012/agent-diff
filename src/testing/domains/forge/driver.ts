import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { DriverState } from "../../state.ts"

export type CommentOnForge = {
  readonly by: string
  readonly body: string
}

export type ThreadOnForge = {
  readonly id: string
  readonly path: string
  readonly line: number
  readonly side?: "old" | "new"
  readonly resolved?: boolean
  readonly outdated?: boolean
  readonly hunk?: string
  readonly commit?: string
  readonly comments: ReadonlyArray<CommentOnForge>
}

export type PullOnForge = {
  readonly branch: string
  readonly number?: number
  readonly head?: string
  readonly url?: string
  readonly threads?: ReadonlyArray<ThreadOnForge>
}

export type Landing = {
  readonly path: string
  readonly line: number
}

export type ForgeOptions = {
  readonly threadsRaw?: string
  readonly morePages?: ReadonlyArray<ReadonlyArray<ThreadOnForge>>
  readonly refuses?: boolean
  readonly reason?: string
  readonly accepts?: ReadonlyArray<Landing>
  readonly answers?: string
  readonly slowMs?: number
}

export type PostedReview = {
  readonly event: string
  readonly comments: ReadonlyArray<{
    readonly path: string
    readonly line: number
    readonly side: string
    readonly body: string
  }>
}

const OWNER = "someone/their-repo"

const quoted = (raw: string): string => `'${raw.replaceAll("'", `'\\''`)}'`

const ECHOES =
  "const asked = JSON.parse(process.argv[1]); if (asked.in_reply_to !== undefined) { process.stdout.write(JSON.stringify({ id: 90210 })) } else { process.stdout.write(JSON.stringify({ comments: asked.comments.map((one) => ({ path: one.path, line: one.line })) })) }"

const answerFor = (options: ForgeOptions): ReadonlyArray<string> => {
  if (options.refuses === true) {
    return [`echo '${options.reason ?? "the forge said no"}' >&2`, "exit 1"]
  }
  if (options.answers !== undefined) return [`printf '%s' ${quoted(options.answers)}`]
  if (options.accepts !== undefined) {
    return [`printf '%s' ${quoted(JSON.stringify({ comments: options.accepts }))}`]
  }
  return [`node -e ${quoted(ECHOES)} "$body"`]
}

const threadsPage = (
  threads: ReadonlyArray<ThreadOnForge>,
  cursor: string | undefined,
): string =>
  JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: cursor !== undefined, endCursor: cursor },
            nodes: threads.map((one) => ({
              id: one.id,
              isResolved: one.resolved === true,
              isOutdated: one.outdated === true,
              path: one.path,
              line: one.line,
              diffSide: one.side === "old" ? "LEFT" : "RIGHT",
              comments: {
                totalCount: one.comments.length,
                nodes: one.comments.map((said, at) => ({
                  databaseId: 1000 + at,
                  author: { login: said.by },
                  body: said.body,
                  diffHunk: at === 0 ? (one.hunk ?? `@@ -1 +${one.line} @@`) : "",
                  originalCommit: { oid: at === 0 ? (one.commit ?? "headcommit") : "" },
                })),
              },
            })),
          },
        },
      },
    },
  })

const numberOf = (pull: PullOnForge, at: number): number => pull.number ?? at + 1

const pagesFor = (
  pull: PullOnForge,
  at: number,
  options: ForgeOptions,
): ReadonlyArray<ReadonlyArray<ThreadOnForge>> =>
  at === 0 ? [pull.threads ?? [], ...(options.morePages ?? [])] : [pull.threads ?? []]

const pageCase = (
  threads: ReadonlyArray<ThreadOnForge>,
  at: number,
  last: number,
): ReadonlyArray<string> => {
  const cursor = at === last ? undefined : `page${at + 1}`
  const pattern = at === 0 ? "*)" : `*"after=page${at}"*)`
  return [pattern, `cat <<'JSON'`, threadsPage(threads, cursor), "JSON", "exit 0", ";;"]
}

const pullCase = (pull: PullOnForge, at: number, options: ForgeOptions): ReadonlyArray<string> => {
  const pages = pagesFor(pull, at, options)
  const last = pages.length - 1
  const later = pages.flatMap((threads, page) =>
    page === 0 ? [] : pageCase(threads, page, last),
  )
  const first = pages[0] ?? []
  return [
    `*"number=${numberOf(pull, at)}"*)`,
    'case "$*" in',
    ...later,
    ...pageCase(first, 0, last),
    "esac",
    ";;",
  ]
}

const oddAnswer = (options: ForgeOptions): ReadonlyArray<string> | undefined => {
  if (options.refuses === true) {
    return [`echo '${options.reason ?? "the forge said no"}' >&2`, "exit 1"]
  }
  return options.threadsRaw === undefined
    ? undefined
    : [`cat <<'JSON'`, options.threadsRaw, "JSON", "exit 0"]
}

const graphqlBranch = (
  pulls: ReadonlyArray<PullOnForge>,
  options: ForgeOptions,
): ReadonlyArray<string> => [
  'if [ "$1" = "api" ] && [ "$2" = "graphql" ]; then',
  ...(oddAnswer(options) ?? [
    'case "$*" in',
    ...pulls.flatMap((pull, at) => pullCase(pull, at, options)),
    "esac",
    `cat <<'JSON'`,
    threadsPage([], undefined),
    "JSON",
    "exit 0",
  ]),
  "fi",
]

const scriptFor = (
  pulls: ReadonlyArray<PullOnForge>,
  posted: string,
  options: ForgeOptions,
): string => {
  const rows = pulls.map((pull) => ({
    headRefName: pull.branch,
    state: "OPEN",
    isDraft: false,
  }))
  const named = Object.fromEntries(
    pulls.map((pull, at) => [
      pull.branch,
      {
        number: pull.number ?? at + 1,
        headRefOid: pull.head ?? "headcommit",
        url: pull.url ?? `https://forge.test/${OWNER}/pull/${pull.number ?? at + 1}`,
      },
    ]),
  )
  return [
    "#!/bin/sh",
    'if [ "$1" = "pr" ] && [ "$2" = "list" ]; then',
    `cat <<'JSON'`,
    JSON.stringify(rows),
    "JSON",
    "exit 0",
    "fi",
    'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
    `node -e 'const named = ${JSON.stringify(JSON.stringify(named))}; const one = JSON.parse(named)[process.argv[1]]; if (one === undefined) { process.exit(1) } process.stdout.write(JSON.stringify(one))' "$3"`,
    "exit $?",
    "fi",
    'if [ "$1" = "repo" ] && [ "$2" = "view" ]; then',
    `printf '%s\\n' '${OWNER}'`,
    "exit 0",
    "fi",
    ...graphqlBranch(pulls, options),
    'if [ "$1" = "api" ]; then',
    "body=$(cat)",
    `printf '%s\\n' "$body" >> "${posted}"`,
    options.slowMs === undefined ? "" : `sleep ${(options.slowMs / 1000).toFixed(2)}`,
    ...answerFor(options),
    "exit 0",
    "fi",
    "exit 1",
  ]
    .filter((line) => line.length > 0)
    .join("\n")
}

export class ForgeTestDriver {
  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  private postedPath(): string {
    return join(this.state.workspace, "bin", "posted.jsonl")
  }

  async holds(pulls: ReadonlyArray<PullOnForge>, options: ForgeOptions = {}): Promise<void> {
    if (options.refuses === true || options.threadsRaw !== undefined) {
      this.state.tracer.cannotReplay("a forge that answers oddly")
    } else {
      this.state.tracer.sawForge(pulls[0]?.threads ?? [])
    }
    const bin = join(this.state.workspace, "bin")
    await mkdir(bin, { recursive: true })
    const path = join(bin, "gh")
    await writeFile(path, `${scriptFor(pulls, this.postedPath(), options)}\n`, { mode: 0o755 })
    this.state.prependPath(bin)
  }

  async posted(): Promise<PostedReview | undefined> {
    return (await this.posts()).at(-1)
  }

  async posts(): Promise<ReadonlyArray<PostedReview>> {
    const raw = await readFile(this.postedPath(), "utf8").catch(() => "")
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as PostedReview)
  }
}
