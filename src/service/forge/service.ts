import { execFile } from "node:child_process"
import { Context, Effect, Layer, Schema } from "effect"
import { ForgeUnavailable } from "./error.ts"

export type PullState = "open" | "draft" | "merged" | "closed"

export type Pull = {
  readonly branch: string
  readonly state: PullState
}

export type Shape = {
  readonly pulls: (repo: string) => Effect.Effect<ReadonlyArray<Pull>, ForgeUnavailable>
}

export class Forge extends Context.Service<Forge, Shape>()("adiff/Forge") {}

const LIMIT = "200"
const TIMEOUT_MS = 4000
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

export const ForgeLive: Layer.Layer<Forge> = Layer.succeed(Forge)({ pulls })
