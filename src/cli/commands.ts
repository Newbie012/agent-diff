import { realpath } from "node:fs/promises"
import { Effect, Option } from "effect"
import { anchorFor, lineOn, parsePatches, type Patch, type Side } from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { isVouched, vouch } from "../domain/review/index.ts"
import {
  Store,
  type Batch,
  type StoreUnreadable,
  type StoreUnwritable,
} from "../service/store/index.ts"
import {
  UnknownBase,
  UnknownBranch,
  UnknownFile,
  UnselectableRange,
} from "./error.ts"

const CONTEXT = 3
const WHOLE_FILE = 100_000
const POLL = "500 millis"

export type BranchSummary = {
  readonly branch: string
  readonly path: string
  readonly head: string
  readonly files: number
  readonly added: number
  readonly removed: number
  readonly unread: number
  readonly layers: number
  readonly stale: boolean
  readonly own: boolean
  readonly base: string
  readonly basis: Basis
}

export type CommentRequest = {
  readonly repo: string
  readonly branch: string
  readonly file: string
  readonly start: number
  readonly end: number
  readonly body: string
  readonly side: Side
  readonly id: string
  readonly at: string
}

export type Basis = "default" | "stacked" | "set"

export type Based = { readonly worktree: Worktree; readonly base: string; readonly basis: Basis }

const AUTO = "auto"

const askedFor = (asked: string | undefined, held: string): { ref: string; basis: Basis } => {
  if (asked !== undefined && asked !== AUTO) return { ref: asked, basis: "set" }
  if (asked === AUTO) return { ref: "", basis: "stacked" }
  return held.length === 0 ? { ref: "", basis: "stacked" } : { ref: held, basis: "set" }
}

export const basedOn = Effect.fn("Cli.basedOn")(function* (
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

const worktreeNamed = Effect.fn("Cli.worktreeNamed")(function* (repo: string, branch: string) {
  const git = yield* Git
  const worktrees = yield* git.worktrees(repo)
  const found = worktrees.find((worktree) => worktree.branch === branch)
  return yield* found === undefined
    ? new UnknownBranch({ repo, branch, known: worktrees.map((w) => w.branch) })
    : Effect.succeed(found)
})

export const findBranch = Effect.fn("Cli.findBranch")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  return (yield* basedOn(repo, yield* worktreeNamed(repo, branch), base)).worktree
})

export const baseFor = Effect.fn("Cli.baseFor")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  return yield* basedOn(repo, yield* worktreeNamed(repo, branch), base)
})

export const patchesOf = Effect.fn("Cli.patchesOf")(function* (
  worktree: Worktree,
  context = CONTEXT,
) {
  const git = yield* Git
  const raw = yield* git.diff(worktree, context)
  return parsePatches(raw)
})

const findPatch = (patches: ReadonlyArray<Patch>, file: string): Option.Option<Patch> =>
  Option.fromNullishOr(patches.find((patch) => patch.path === file))

const rowsCovering = (
  patch: Patch,
  side: Side,
  start: number,
  end: number,
): ReadonlyArray<number> =>
  patch.rows
    .filter((row) =>
      Option.match(lineOn(row, side), {
        onNone: () => false,
        onSome: (line) => line >= start && line <= end,
      }),
    )
    .map((row) => row.index)

const waitingOn = Effect.fn("Cli.waitingOn")(function* (worktree: Worktree) {
  const store = yield* Store
  const owed = yield* store.take(worktree.path)
  const told = yield* store.layers(worktree.path)
  return {
    unread: owed.reduce((total, batch) => total + batch.comments.length, 0),
    layers: Option.match(told, { onNone: () => 0, onSome: (layers) => layers.layers.length }),
    stale: Option.match(told, { onNone: () => false, onSome: (layers) => layers.head !== worktree.head }),
  }
})

export const listBranches = Effect.fn("Cli.listBranches")(function* (repo: string, base?: string) {
  const git = yield* Git
  const worktrees = yield* git.worktrees(repo)
  const summaries: Array<BranchSummary> = []
  for (const found of worktrees) {
    const based = yield* basedOn(repo, found, base)
    const worktree = based.worktree
    const stat = yield* git.stat(worktree)
    const waiting = yield* waitingOn(worktree)
    summaries.push({
      branch: worktree.branch,
      path: worktree.path,
      head: worktree.head,
      files: stat.files,
      added: stat.added,
      removed: stat.removed,
      unread: waiting.unread,
      layers: waiting.layers,
      stale: waiting.stale,
      own: worktree.own,
      base: based.base,
      basis: based.basis,
    })
  }
  return summaries.filter((summary) => summary.files > 0)
})

export type VouchRequest = {
  readonly repo: string
  readonly branch: string
  readonly file: string
}

export type VouchReport = {
  readonly vouched: ReadonlyArray<string>
  readonly total: number
}

export type ProgressReport = VouchReport

const blobOf = (patches: ReadonlyArray<Patch>, file: string): Option.Option<string> =>
  Option.map(findPatch(patches, file), (patch) => patch.blob)

export const toggleVouch = Effect.fn("Cli.toggleVouch")(function* (request: VouchRequest) {
  const store = yield* Store
  const worktree = yield* findBranch(request.repo, request.branch)
  const patches = yield* patchesOf(worktree)

  const blob = yield* Option.match(blobOf(patches, request.file), {
    onNone: () =>
      new UnknownFile({ file: request.file, known: patches.map((patch) => patch.path) }),
    onSome: Effect.succeed,
  })

  const current = yield* store.state(worktree.path)
  const next = vouch(current.vouches, request.file, blob)
  yield* store.saveState(worktree.path, { ...current, vouches: next })

  const files = patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((file) => isVouched(next, file.path, file.blob)).map((file) => file.path),
    total: patches.length,
  } satisfies VouchReport
})

export const reviewProgress = Effect.fn("Cli.reviewProgress")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch, base)
  const patches = yield* patchesOf(worktree)
  const current = yield* store.state(worktree.path)
  const files = patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  return {
    vouched: files.filter((file) => isVouched(current.vouches, file.path, file.blob)).map((f) => f.path),
    total: patches.length,
  }
})

const bodyOf = (entry: { readonly body: string }): string => entry.body

type Reading = {
  readonly spoken: ReadonlyArray<{ readonly comment: string; readonly body: string; readonly asks: boolean }>
  readonly settled: Readonly<Record<string, string>>
  readonly head: string
  readonly shown: ReadonlySet<string>
  readonly read: Readonly<Record<string, number>>
}

const sentOf = (comment: PendingComment, reading: Reading) => {
  const { spoken, settled, head, shown, read } = reading
  const mine = spoken.filter((entry) => entry.comment === comment.id)
  return {
    id: comment.id,
    file: comment.file,
    side: comment.side,
    start: comment.start,
    end: comment.end,
    body: comment.body,
    settled: Object.hasOwn(settled, comment.id),
    stale: comment.head !== head,
    outside: !shown.has(comment.file),
    unread: Math.max(0, mine.length - (read[comment.id] ?? 0)),
    asks: mine.at(-1)?.asks === true,
    answers: mine.map(bodyOf),
  }
}

export const listSent = Effect.fn("Cli.listSent")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch, base)
  const spoken = yield* store.answers(worktree.path)
  const current = yield* store.state(worktree.path)
  const shown = new Set((yield* patchesOf(worktree)).map((patch) => patch.path))
  return flatten(yield* store.inbox(worktree.path))
    .filter((comment) => !Object.hasOwn(current.removed, comment.id))
    .map((comment) =>
      sentOf(comment, {
        spoken,
        settled: current.settled,
        head: worktree.head,
        shown,
        read: current.read,
      }),
    )
})

export const submitComment = Effect.fn("Cli.submitComment")(function* (request: CommentRequest) {
  const store = yield* Store
  const worktree = yield* findBranch(request.repo, request.branch)
  const patches = yield* patchesOf(worktree, WHOLE_FILE)
  const patch = findPatch(patches, request.file)

  const resolved = yield* Option.match(patch, {
    onNone: () =>
      new UnknownFile({ file: request.file, known: patches.map((candidate) => candidate.path) }),
    onSome: Effect.succeed,
  })

  const rows = rowsCovering(resolved, request.side, request.start, request.end)
  const first = rows[0]
  const last = rows.at(-1)
  const anchor =
    first === undefined || last === undefined ? Option.none() : anchorFor(resolved, first, last)

  const chosen = yield* Option.match(anchor, {
    onNone: () => new UnselectableRange({ file: request.file, start: request.start, end: request.end }),
    onSome: Effect.succeed,
  })

  const batch: Batch = {
    id: request.id,
    at: request.at,
    head: worktree.head,
    comments: [{ id: request.id, anchor: chosen, body: request.body }],
  }
  yield* store.submit(worktree.path, batch)
  return batch
})

export const listPatches = Effect.fn("Cli.listPatches")(function* (
  repo: string,
  branch: string,
  context = CONTEXT,
) {
  const worktree = yield* findBranch(repo, branch)
  const git = yield* Git
  return parsePatches(yield* git.diff(worktree, context))
})

export type PendingComment = {
  readonly id: string
  readonly at: string
  readonly head: string
  readonly file: string
  readonly side: Side
  readonly start: number
  readonly end: number
  readonly snippet: string
  readonly body: string
}

const flatten = (batches: ReadonlyArray<Batch>): ReadonlyArray<PendingComment> =>
  batches.flatMap((batch) =>
    batch.comments.map((comment) => ({
      id: comment.id,
      at: batch.at,
      head: batch.head,
      file: comment.anchor.path,
      side: comment.anchor.side,
      start: comment.anchor.start,
      end: comment.anchor.end,
      snippet: comment.anchor.snippet,
      body: comment.body,
    })),
  )

export const takeComments = Effect.fn("Cli.takeComments")(function* (worktree: string) {
  const store = yield* Store
  const resolved = yield* Effect.promise(() => realpath(worktree))
  return flatten(yield* store.take(resolved))
})

export const repoOf = Effect.fn("Cli.repoOf")(function* (worktree: string) {
  const git = yield* Git
  return yield* git.repoOf(worktree)
})

export const worktreeOf = Effect.fn("Cli.worktreeOf")(function* (repo: string, branch: string) {
  const found = yield* findBranch(repo, branch)
  return found.path
})

export const branchAt = Effect.fn("Cli.branchAt")(function* (worktree: string) {
  const store = yield* Store
  const resolved = yield* Effect.promise(() => realpath(worktree))
  return yield* store.branchAt(resolved)
})

export const awaitComments = (
  worktree: string,
  deadline: number,
): Effect.Effect<ReadonlyArray<PendingComment>, StoreUnreadable | StoreUnwritable, Store> =>
  takeComments(worktree).pipe(
    Effect.flatMap((comments) =>
      comments.length > 0 || Date.now() >= deadline
        ? Effect.succeed(comments)
        : Effect.sleep(POLL).pipe(Effect.flatMap(() => awaitComments(worktree, deadline))),
    ),
  )

export const saveReport = Effect.fn("Cli.saveReport")(function* (stamp: string, text: string) {
  const store = yield* Store
  return yield* store.saveReport(stamp, text)
})

export const fileSource = Effect.fn("Cli.fileSource")(function* (
  repo: string,
  branch: string,
  file: string,
) {
  const git = yield* Git
  const worktree = yield* findBranch(repo, branch)
  const found = yield* git.source(worktree, file)
  return Option.getOrElse(found, (): ReadonlyArray<string> => [])
})

export const fileBefore = Effect.fn("Cli.fileBefore")(function* (
  repo: string,
  branch: string,
  file: string,
) {
  const git = yield* Git
  const worktree = yield* findBranch(repo, branch)
  const found = yield* git.blob(worktree, file)
  return Option.getOrElse(found, (): ReadonlyArray<string> => [])
})

export const saveWrap = Effect.fn("Cli.saveWrap")(function* (wrap: boolean) {
  const store = yield* Store
  const current = yield* store.settings
  yield* store.saveSettings({ ...current, wrap })
})

export const saveSticky = Effect.fn("Cli.saveSticky")(function* (sticky: boolean) {
  const store = yield* Store
  const current = yield* store.settings
  yield* store.saveSettings({ ...current, sticky })
})

export const setBase = Effect.fn("Cli.setBase")(function* (
  repo: string,
  branch: string,
  base: string,
) {
  const store = yield* Store
  const based = yield* baseFor(repo, branch, base)
  const current = yield* store.state(based.worktree.path)
  yield* store.saveState(based.worktree.path, { ...current, base })
  return { branch, base: based.base, basis: based.basis }
})

export const clearBase = Effect.fn("Cli.clearBase")(function* (repo: string, branch: string) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  const current = yield* store.state(worktree.path)
  yield* store.saveState(worktree.path, { ...current, base: "" })
  const based = yield* baseFor(repo, branch)
  return { branch, base: based.base, basis: based.basis }
})

export const markRead = Effect.fn("Cli.markRead")(function* (
  repo: string,
  branch: string,
  id: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  const spoken = yield* store.answers(worktree.path)
  const seen = spoken.filter((entry) => entry.comment === id).length
  const current = yield* store.state(worktree.path)
  if ((current.read[id] ?? 0) >= seen) return { id, unread: 0 }
  yield* store.saveState(worktree.path, {
    ...current,
    read: { ...current.read, [id]: seen },
  })
  return { id, unread: 0 }
})
