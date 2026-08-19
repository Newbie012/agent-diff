import { Effect } from "effect"
import { Git } from "../service/git/index.ts"
import { readingOf, type BranchReading } from "./commands.ts"

export type Match = {
  readonly path: string
  readonly line: number
  readonly text: string
  readonly changed: boolean
  readonly around: ReadonlyArray<string>
}

const HIT = /^(.+?):(\d+):(.*)$/
const NEAR = /^(.+?)-(\d+)-(.*)$/

type Row = { readonly path: string; readonly line: number; readonly text: string; readonly hit: boolean }

const rowOf = (line: string): Row | undefined => {
  const hit = HIT.exec(line)
  if (hit !== null) {
    return { path: hit[1] ?? "", line: Number(hit[2]), text: hit[3] ?? "", hit: true }
  }
  const near = NEAR.exec(line)
  if (near === null) return undefined
  return { path: near[1] ?? "", line: Number(near[2]), text: near[3] ?? "", hit: false }
}

const readRows = (raw: string): ReadonlyArray<Row> =>
  raw
    .split("\n")
    .filter((line) => line.length > 0 && line !== "--")
    .flatMap((line) => {
      const row = rowOf(line)
      return row === undefined ? [] : [row]
    })

const near = (rows: ReadonlyArray<Row>, at: number): ReadonlyArray<string> => {
  const found = rows[at]
  if (found === undefined) return []
  return rows
    .filter((row) => row.path === found.path && Math.abs(row.line - found.line) <= 2)
    .map((row) => `${String(row.line).padStart(5)} ${row.text}`)
}

const byChangedFirst = (left: Match, right: Match): number => {
  if (left.changed !== right.changed) return left.changed ? -1 : 1
  return left.path === right.path ? left.line - right.line : left.path.localeCompare(right.path)
}

export const searchIn = Effect.fn("Cli.searchIn")(function* (
  reading: BranchReading,
  term: string,
) {
  const git = yield* Git
  const worktree = reading.worktree
  const touched = new Set(reading.patches.map((patch) => patch.path))
  const rows = readRows(yield* git.grep(worktree, term))
  const found: Array<Match> = []
  for (const [at, row] of rows.entries()) {
    if (!row.hit) continue
    found.push({
      path: row.path,
      line: row.line,
      text: row.text.trim(),
      changed: touched.has(row.path),
      around: near(rows, at),
    })
  }
  return found.toSorted(byChangedFirst)
})

export const searchBranch = Effect.fn("Cli.searchBranch")(function* (
  repo: string,
  branch: string,
  term: string,
) {
  return yield* searchIn(yield* readingOf(repo, branch), term)
})
