import { realpath } from "node:fs/promises"
import { Effect, Option } from "effect"
import { type Patch } from "../domain/patch/index.ts"
import { AT_ONCE, Git, type Worktree } from "../service/git/index.ts"
import { Store } from "../service/store/index.ts"
import { UnknownBase, UnknownBranch, UnknownWorktree } from "./error.ts"
import { parsePatches } from "../domain/patch/index.ts"

export const realOf = (worktree: string): Effect.Effect<string, UnknownWorktree> =>
  Effect.tryPromise({
    try: () => realpath(worktree),
    catch: () => new UnknownWorktree({ worktree, known: [] }),
  })

export type BranchSummary = {
  readonly branch: string
  readonly path: string
  readonly head: string
  readonly files: number
  readonly added: number
  readonly removed: number
  readonly unanswered: number
  readonly layers: number
  readonly stale: boolean
  readonly own: boolean
  readonly base: string
  readonly basis: Basis
}

export type Basis = "default" | "stacked" | "set"

export type Based = { readonly worktree: Worktree; readonly base: string; readonly basis: Basis }

const AUTO = "auto"

const askedFor = (asked: string | undefined, held: string): { ref: string; basis: Basis } => {
  if (asked !== undefined && asked !== AUTO) return { ref: asked, basis: "set" }
  if (asked === AUTO) return { ref: "", basis: "stacked" }
  return held.length === 0 ? { ref: "", basis: "stacked" } : { ref: held, basis: "set" }
}

export const basedOn = Effect.fn("Review.basedOn")(function* (
  repo: string,
  worktree: Worktree,
  asked?: string,
) {
  const git = yield* Git
  const store = yield* Store
  const held = (yield* store.state(worktree.path)).base
  const wanted = askedFor(asked, held)
  const fallback = yield* git.defaultBranch(repo)
  const guessed = wanted.ref.length === 0
  const ref = guessed ? yield* git.stackParent(repo, worktree.branch) : wanted.ref
  const asItWas: Based = { worktree, base: ref, basis: "default" }
  if (!(yield* git.resolves(repo, ref))) {
    if (guessed) return asItWas
    return yield* new UnknownBase({ branch: worktree.branch, base: ref, reason: "missing" })
  }
  const shared = yield* git.sharedWith(repo, worktree.branch, ref)
  if (shared.length === 0) {
    if (guessed) return asItWas
    return yield* new UnknownBase({ branch: worktree.branch, base: ref, reason: "unrelated" })
  }
  const basis: Basis = guessed ? (ref === fallback ? "default" : "stacked") : wanted.basis
  return {
    worktree: { ...worktree, base: shared.slice(0, 8) },
    base: ref,
    basis,
  } satisfies Based
})

const worktreeNamed = Effect.fn("Review.worktreeNamed")(function* (repo: string, branch: string) {
  const git = yield* Git
  const worktrees = yield* git.worktrees(repo)
  const found = worktrees.find((worktree) => worktree.branch === branch)
  return yield* found === undefined
    ? new UnknownBranch({ repo, branch, known: worktrees.map((w) => w.branch) })
    : Effect.succeed(found)
})

export const findBranch = Effect.fn("Review.findBranch")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  return (yield* basedOn(repo, yield* worktreeNamed(repo, branch), base)).worktree
})

export const baseFor = Effect.fn("Review.baseFor")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  return yield* basedOn(repo, yield* worktreeNamed(repo, branch), base)
})

const waitingOn = Effect.fn("Review.waitingOn")(function* (worktree: Worktree) {
  const store = yield* Store
  const owed = yield* store.owed(worktree.path)
  const told = yield* store.layers(worktree.path)
  return {
    unanswered: owed.reduce((total, batch) => total + batch.comments.length, 0),
    layers: Option.match(told, { onNone: () => 0, onSome: (layers) => layers.layers.length }),
    stale: Option.match(told, { onNone: () => false, onSome: (layers) => layers.head !== worktree.head }),
  }
})

const summaryOf = Effect.fn("Review.summaryOf")(function* (
  repo: string,
  found: Worktree,
  base?: string,
) {
  const git = yield* Git
  const based = yield* basedOn(repo, found, base)
  const worktree = based.worktree
  const stat = yield* git.stat(worktree)
  const waiting = yield* waitingOn(worktree)
  return {
    branch: worktree.branch,
    path: worktree.path,
    head: worktree.head,
    files: stat.files,
    added: stat.added,
    removed: stat.removed,
    unanswered: waiting.unanswered,
    layers: waiting.layers,
    stale: waiting.stale,
    own: worktree.own,
    base: based.base,
    basis: based.basis,
  } satisfies BranchSummary
})

export const summaryFor = Effect.fn("Review.summaryFor")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  const worktree = yield* findBranch(repo, branch, base)
  return yield* summaryOf(repo, worktree, base)
})

export const listBranches = Effect.fn("Review.listBranches")(function* (repo: string, base?: string) {
  const git = yield* Git
  const worktrees = yield* git.worktrees(repo)
  const summaries = yield* Effect.forEach(worktrees, (found) => summaryOf(repo, found, base), {
    concurrency: AT_ONCE,
  })
  return summaries.filter((summary) => summary.files > 0)
})

export type BranchReading = {
  readonly worktree: Worktree
  readonly patches: ReadonlyArray<Patch>
}

export const readingOf = Effect.fn("Review.readingOf")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  const worktree = yield* findBranch(repo, branch, base)
  return { worktree, patches: yield* patchesOf(worktree) } satisfies BranchReading
})

export const markOpened = Effect.fn("Review.markOpened")(function* (worktreePath: string, at: string) {
  const store = yield* Store
  yield* store.changeState(worktreePath, (was) => ({ ...was, openedAt: at }))
})

export const lastOpenedIn = Effect.fn("Review.lastOpenedIn")(function* (repo: string) {
  const store = yield* Store
  const git = yield* Git
  const trees = yield* git.worktrees(repo)
  const openedOf = (tree: Worktree) =>
    Effect.map(store.state(tree.path), (held) => ({ branch: tree.branch, at: held.openedAt }))
  const read = yield* Effect.forEach(trees, openedOf)
  const opened = read.filter((one) => one.at.length > 0)
  return opened.toSorted((left, right) => right.at.localeCompare(left.at))[0]
})

export const repoOf = Effect.fn("Review.repoOf")(function* (worktree: string) {
  const git = yield* Git
  return yield* git.repoOf(worktree)
})

export const worktreeOf = Effect.fn("Review.worktreeOf")(function* (repo: string, branch: string) {
  const found = yield* findBranch(repo, branch)
  return found.path
})

export const branchAt = Effect.fn("Review.branchAt")(function* (worktree: string) {
  const store = yield* Store
  const resolved = yield* realOf(worktree)
  return yield* store.branchAt(resolved)
})

export const saveReport = Effect.fn("Review.saveReport")(function* (stamp: string, text: string) {
  const store = yield* Store
  return yield* store.saveReport(stamp, text)
})

export const listRefs = Effect.fn("Review.listRefs")(function* (repo: string) {
  const git = yield* Git
  return yield* git.refs(repo)
})

const MOST_RECENT = 5

const forOne = (count: number): string =>
  count === 1 ? "the last commit" : `the last ${count} commits`

export const recentBases = Effect.fn("Review.recentBases")(function* (
  repo: string,
  branch: string,
) {
  const git = yield* Git
  const found = yield* git.commits(repo, branch, MOST_RECENT + 1)
  return found.flatMap((commit, at) => {
    if (at === 0) return []
    const oldest = found[at - 1]?.said ?? ""
    const said = at === 1 ? oldest : `back to ${oldest}`
    return [{ ref: commit.sha, said: `${forOne(at)} · ${said}` }]
  })
})

export const setBase = Effect.fn("Review.setBase")(function* (
  repo: string,
  branch: string,
  base: string,
) {
  const store = yield* Store
  const based = yield* baseFor(repo, branch, base)
  yield* store.changeState(based.worktree.path, (was) => ({ ...was, base }))
  return { branch, base: based.base, basis: based.basis }
})

export const clearBase = Effect.fn("Review.clearBase")(function* (repo: string, branch: string) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  yield* store.changeState(worktree.path, (was) => ({ ...was, base: "" }))
  const based = yield* baseFor(repo, branch)
  return { branch, base: based.base, basis: based.basis }
})

export const CONTEXT = 3

export const patchesOf = Effect.fn("Review.patchesOf")(function* (
  worktree: Worktree,
  context = CONTEXT,
  only?: string,
) {
  const git = yield* Git
  const raw = yield* git.diff(worktree, context, only)
  return parsePatches(raw)
})
