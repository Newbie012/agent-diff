import { execFile } from "node:child_process"
import { Context, Effect, Layer } from "effect"

export type PullState = "open" | "draft" | "merged" | "closed"

export type Pull = {
  readonly branch: string
  readonly state: PullState
}

export type Shape = {
  readonly pulls: (repo: string) => Effect.Effect<ReadonlyArray<Pull>>
}

export class Forge extends Context.Service<Forge, Shape>()("Forge") {}

const LIMIT = "200"
const TIMEOUT_MS = 4000

type Row = {
  readonly headRefName?: unknown
  readonly state?: unknown
  readonly isDraft?: unknown
}

const stateOf = (row: Row): PullState => {
  if (row.isDraft === true && row.state === "OPEN") return "draft"
  if (row.state === "MERGED") return "merged"
  if (row.state === "CLOSED") return "closed"
  return "open"
}

const parse = (raw: string): ReadonlyArray<Pull> => {
  const rows = JSON.parse(raw) as ReadonlyArray<Row>
  if (!Array.isArray(rows)) return []
  return rows
    .filter((row) => typeof row.headRefName === "string")
    .map((row) => ({ branch: String(row.headRefName), state: stateOf(row) }))
}

const ask = (repo: string): Promise<ReadonlyArray<Pull>> =>
  new Promise((resolve) => {
    execFile(
      "gh",
      ["pr", "list", "--state", "all", "--limit", LIMIT, "--json", "headRefName,state,isDraft"],
      { cwd: repo, timeout: TIMEOUT_MS, encoding: "utf8" },
      (error, stdout) => {
        if (error !== null) return resolve([])
        try {
          resolve(parse(stdout))
        } catch {
          resolve([])
        }
      },
    )
  })

export const ForgeLive = Layer.succeed(Forge)({
  pulls: (repo: string) => Effect.promise(() => ask(repo)),
})
