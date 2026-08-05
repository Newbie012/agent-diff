import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { Context, Effect, Layer, Option } from "effect"
import { FileUnreadable } from "./error.ts"
import type { DiffStat, Worktree } from "./model.ts"
import { gitOrEmpty } from "./run.ts"

const DEFAULT_BRANCH_CANDIDATES = ["origin/master", "origin/main", "master", "main"]

const STAT = /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/

type Shape = {
  readonly worktrees: (repo: string) => Effect.Effect<ReadonlyArray<Worktree>>
  readonly diff: (worktree: Worktree, context: number) => Effect.Effect<string>
  readonly stat: (worktree: Worktree) => Effect.Effect<DiffStat>
  readonly source: (
    worktree: Worktree,
    path: string,
  ) => Effect.Effect<Option.Option<ReadonlyArray<string>>>
}

export class Git extends Context.Service<Git, Shape>()("adiff/Git") {}

const parseStat = (raw: string): DiffStat => {
  const matched = STAT.exec(raw)
  return {
    files: Number(matched?.[1] ?? 0),
    added: Number(matched?.[2] ?? 0),
    removed: Number(matched?.[3] ?? 0),
  }
}

type Entry = { path: string; branch: string; head: string; detached: boolean }

const readEntries = (porcelain: string): ReadonlyArray<Entry> => {
  const entries: Array<Entry> = []
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      entries.push({ path: line.slice("worktree ".length), branch: "", head: "", detached: false })
    }
    const current = entries.at(-1)
    if (current === undefined) continue
    if (line.startsWith("branch ")) current.branch = line.slice("branch ".length).replace("refs/heads/", "")
    if (line.startsWith("HEAD ")) current.head = line.slice("HEAD ".length)
    if (line === "detached") current.detached = true
  }
  return entries
}

const baseNames = new Map<string, string>()
const mergeBases = new Map<string, string>()

const findDefaultBranch = Effect.fn("Git.findDefaultBranch")(function* (repo: string) {
  const symbolic = yield* gitOrEmpty(repo, ["symbolic-ref", "refs/remotes/origin/HEAD"])
  if (symbolic.trim().length > 0) return symbolic.trim().replace("refs/remotes/", "")
  for (const candidate of DEFAULT_BRANCH_CANDIDATES) {
    const verified = yield* gitOrEmpty(repo, ["rev-parse", "--verify", candidate])
    if (verified.trim().length > 0) return candidate
  }
  return "HEAD"
})

const defaultBranch = Effect.fn("Git.defaultBranch")(function* (repo: string) {
  const known = baseNames.get(repo)
  if (known !== undefined) return known
  const found = yield* findDefaultBranch(repo)
  baseNames.set(repo, found)
  return found
})

const mergeBaseOf = Effect.fn("Git.mergeBase")(function* (entry: Entry, base: string) {
  const key = `${entry.path} ${entry.head} ${base}`
  const known = mergeBases.get(key)
  if (known !== undefined) return known
  const found = (yield* gitOrEmpty(entry.path, ["merge-base", base, "HEAD"])).trim()
  mergeBases.set(key, found)
  return found
})

const toWorktree = Effect.fn("Git.toWorktree")(function* (entry: Entry, base: string) {
  const mergeBase = yield* mergeBaseOf(entry, base)
  return {
    path: entry.path,
    branch: entry.detached ? `(detached ${entry.head.slice(0, 8)})` : entry.branch,
    head: entry.head.slice(0, 8),
    base: mergeBase.slice(0, 8),
    detached: entry.detached,
  } satisfies Worktree
})

const splitLines = (text: string): ReadonlyArray<string> => text.split("\n")

const absent = Effect.succeed(Option.none<string>())

const readText = Effect.fn("Git.readText")(function* (absolute: string, path: string) {
  return yield* Effect.tryPromise({
    try: () => readFile(absolute, "utf8"),
    catch: (cause) => new FileUnreadable({ path, reason: String(cause) }),
  }).pipe(Effect.map(Option.some), Effect.catchTag("FileUnreadable", () => absent))
})

const listWorktrees = Effect.fn("Git.worktrees")(function* (repo: string) {
  const porcelain = yield* gitOrEmpty(repo, ["worktree", "list", "--porcelain"])
  const base = yield* defaultBranch(repo)
  const entries = readEntries(porcelain)
  const found: Array<Worktree> = []
  for (const entry of entries) found.push(yield* toWorktree(entry, base))
  return found
})

const readDiff = Effect.fn("Git.diff")(function* (worktree: Worktree, context: number) {
  const target = worktree.base.length > 0 ? worktree.base : "HEAD"
  return yield* gitOrEmpty(worktree.path, ["diff", `-U${context}`, target])
})

const readStat = Effect.fn("Git.stat")(function* (worktree: Worktree) {
  const raw = yield* gitOrEmpty(worktree.path, ["diff", "--shortstat", worktree.base])
  return parseStat(raw)
})

const readSource = Effect.fn("Git.source")(function* (worktree: Worktree, path: string) {
  const text = yield* readText(join(worktree.path, path), path)
  return Option.map(text, splitLines)
})

const shape: Shape = {
  worktrees: listWorktrees,
  diff: readDiff,
  stat: readStat,
  source: readSource,
}

export const GitLive = Layer.succeed(Git)(shape)
