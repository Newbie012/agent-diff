import { readFile, realpath } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Context, Effect, Layer, Option } from "effect"
import { FileUnreadable } from "./error.ts"
import type { DiffStat, Worktree } from "./model.ts"
import { gitOrEmpty } from "./run.ts"

const GREP_CONTEXT = 2
const AT_ONCE = 8

const DEFAULT_BRANCH_CANDIDATES = ["origin/master", "origin/main", "master", "main"]

const STAT = /(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/

type Shape = {
  readonly worktrees: (repo: string) => Effect.Effect<ReadonlyArray<Worktree>>
  readonly repoOf: (worktree: string) => Effect.Effect<string>
  readonly diff: (worktree: Worktree, context: number, only?: string) => Effect.Effect<string>
  readonly stat: (worktree: Worktree) => Effect.Effect<DiffStat>
  readonly source: (
    worktree: Worktree,
    path: string,
  ) => Effect.Effect<Option.Option<ReadonlyArray<string>>>
  readonly grep: (worktree: Worktree, term: string) => Effect.Effect<string>
  readonly blob: (
    worktree: Worktree,
    path: string,
  ) => Effect.Effect<Option.Option<ReadonlyArray<string>>>
  readonly defaultBranch: (repo: string) => Effect.Effect<string>
  readonly stackParent: (repo: string, branch: string) => Effect.Effect<string>
  readonly resolves: (repo: string, ref: string) => Effect.Effect<boolean>
  readonly sharedWith: (repo: string, branch: string, ref: string) => Effect.Effect<string>
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

const toWorktree = Effect.fn("Git.toWorktree")(function* (entry: Entry, base: string, own: boolean) {
  const mergeBase = yield* mergeBaseOf(entry, base)
  return {
    path: entry.path,
    branch: entry.detached ? `(detached ${entry.head.slice(0, 8)})` : entry.branch,
    head: entry.head.slice(0, 8),
    base: mergeBase.slice(0, 8),
    detached: entry.detached,
    own,
  } satisfies Worktree
})

const branchTips = Effect.fn("Git.branchTips")(function* (repo: string) {
  const raw = yield* gitOrEmpty(repo, [
    "for-each-ref",
    "--format=%(objectname) %(refname:short)",
    "refs/heads",
  ])
  const tips = new Map<string, Array<string>>()
  for (const line of raw.split("\n")) {
    const [sha, ...rest] = line.trim().split(" ")
    const name = rest.join(" ")
    if (sha === undefined || sha.length === 0 || name.length === 0) continue
    const held = tips.get(sha)
    if (held === undefined) tips.set(sha, [name])
    else held.push(name)
  }
  return tips
})

const parents = new Map<string, string>()

const parentOf = Effect.fn("Git.parentOf")(function* (repo: string, branch: string, fallback: string) {
  const own = (yield* gitOrEmpty(repo, ["rev-list", `${fallback}..${branch}`]))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  const tip = own[0]
  if (tip === undefined) return fallback
  const key = `${repo} ${branch} ${tip} ${fallback}`
  const known = parents.get(key)
  if (known !== undefined) return known
  const tips = yield* branchTips(repo)
  const found = own
    .slice(1)
    .flatMap((sha) => tips.get(sha) ?? [])
    .find((name) => name !== branch)
  parents.set(key, found ?? fallback)
  return found ?? fallback
})

const splitLines = (text: string): ReadonlyArray<string> => text.split("\n")

const absent = Effect.succeed(Option.none<string>())

const readText = Effect.fn("Git.readText")(function* (absolute: string, path: string) {
  return yield* Effect.tryPromise({
    try: () => readFile(absolute, "utf8"),
    catch: (cause) => new FileUnreadable({ path, reason: String(cause) }),
  }).pipe(Effect.map(Option.some), Effect.catchTag("FileUnreadable", () => absent))
})

const settled = (path: string): Effect.Effect<string> =>
  Effect.promise(() => realpath(path).catch(() => resolve(path)))

const seenAs = Effect.fn("Git.seenAs")(function* (entry: Entry, base: string, opened: string) {
  const path = yield* settled(entry.path)
  return yield* toWorktree(entry, base, path === opened)
})

const listWorktrees = Effect.fn("Git.worktrees")(function* (repo: string) {
  const porcelain = yield* gitOrEmpty(repo, ["worktree", "list", "--porcelain"])
  const base = yield* defaultBranch(repo)
  const entries = readEntries(porcelain)
  const opened = yield* settled(repo)
  const read = (entry: Entry) => seenAs(entry, base, opened)
  return yield* Effect.forEach(entries, read, { concurrency: AT_ONCE })
})

const readDiff = Effect.fn("Git.diff")(function* (
  worktree: Worktree,
  context: number,
  only?: string,
) {
  const target = worktree.base.length > 0 ? worktree.base : "HEAD"
  const scope = only === undefined ? [] : ["--", only]
  return yield* gitOrEmpty(worktree.path, ["diff", `-U${context}`, target, ...scope])
})

const readStat = Effect.fn("Git.stat")(function* (worktree: Worktree) {
  const raw = yield* gitOrEmpty(worktree.path, ["diff", "--shortstat", worktree.base])
  return parseStat(raw)
})

const readSource = Effect.fn("Git.source")(function* (worktree: Worktree, path: string) {
  const text = yield* readText(join(worktree.path, path), path)
  return Option.map(text, splitLines)
})

const readBlob = Effect.fn("Git.blob")(function* (worktree: Worktree, path: string) {
  const target = worktree.base.length > 0 ? worktree.base : "HEAD"
  const raw = yield* gitOrEmpty(worktree.path, ["show", `${target}:${path}`])
  return raw.length === 0 ? Option.none<ReadonlyArray<string>>() : Option.some(splitLines(raw))
})

const readGrep = Effect.fn("Git.grep")(function* (worktree: Worktree, term: string) {
  return yield* gitOrEmpty(worktree.path, [
    "grep",
    "--no-color",
    "-n",
    "-I",
    "-F",
    "-i",
    "-w",
    "-C",
    String(GREP_CONTEXT),
    "-e",
    term,
  ])
})

const findRepo = Effect.fn("Git.repoOf")(function* (worktree: string) {
  const common = yield* gitOrEmpty(worktree, [
    "rev-parse",
    "--path-format=absolute",
    "--git-common-dir",
  ])
  const trimmed = common.trim()
  return trimmed.length === 0 ? resolve(worktree) : resolve(trimmed, "..")
})

const refResolves = Effect.fn("Git.resolves")(function* (repo: string, ref: string) {
  const found = yield* gitOrEmpty(repo, ["rev-parse", "--verify", `${ref}^{commit}`])
  return found.trim().length > 0
})

const sharedCommit = Effect.fn("Git.sharedWith")(function* (
  repo: string,
  branch: string,
  ref: string,
) {
  return (yield* gitOrEmpty(repo, ["merge-base", branch, ref])).trim()
})

const shape: Shape = {
  worktrees: listWorktrees,
  repoOf: findRepo,
  diff: readDiff,
  stat: readStat,
  source: readSource,
  blob: readBlob,
  grep: readGrep,
  defaultBranch,
  stackParent: (repo: string, branch: string) =>
    defaultBranch(repo).pipe(Effect.flatMap((fallback) => parentOf(repo, branch, fallback))),
  resolves: refResolves,
  sharedWith: sharedCommit,
}

export const GitLive = Layer.succeed(Git)(shape)
