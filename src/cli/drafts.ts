import { Effect } from "effect"
import { Forge, type ForgeComment } from "../service/forge/index.ts"
import { Store, type StoredDraft } from "../service/store/index.ts"
import { anchorIn, findBranch } from "./commands.ts"
import { NothingDrafted, PartlySent, PullMoved, UnknownDraft } from "./error.ts"
import type { Side } from "../domain/patch/index.ts"
import type { Worktree } from "../service/git/index.ts"

export type DraftRequest = {
  readonly repo: string
  readonly branch: string
  readonly file: string
  readonly start: number
  readonly end: number
  readonly body: string
  readonly side: Side
  readonly id: string
  readonly at: string
  readonly wroteBy: "reviewer" | "agent"
}

export type ReportedDraft = {
  readonly id: string
  readonly file: string
  readonly side: Side
  readonly start: number
  readonly end: number
  readonly body: string
  readonly at: string
  readonly wroteBy: "reviewer" | "agent"
}

export type Dispatched = {
  readonly sent: number
  readonly url: string
  readonly held: number
}

const reported = (draft: StoredDraft): ReportedDraft => ({
  id: draft.id,
  file: draft.anchor.path,
  side: draft.anchor.side,
  start: draft.anchor.start,
  end: draft.anchor.end,
  body: draft.body,
  at: draft.at,
  wroteBy: draft.wroteBy,
})

export const listDrafts = Effect.fn("Cli.listDrafts")(function* (repo: string, branch: string) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  return (yield* store.drafts(worktree.path)).map(reported)
})

export const addDraft = Effect.fn("Cli.addDraft")(function* (request: DraftRequest) {
  const store = yield* Store
  const worktree = yield* findBranch(request.repo, request.branch)
  const anchor = yield* anchorIn(worktree, request)
  const held = yield* store.drafts(worktree.path)
  const one: StoredDraft = {
    id: request.id,
    anchor,
    body: request.body,
    at: request.at,
    wroteBy: request.wroteBy,
  }
  yield* store.saveDrafts(worktree.path, [...held, one])
  return reported(one)
})

export const editDraft = Effect.fn("Cli.editDraft")(function* (
  repo: string,
  branch: string,
  id: string,
  body: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  const held = yield* store.drafts(worktree.path)
  const found = held.find((one) => one.id === id)
  if (found === undefined) return yield* new UnknownDraft({ id })
  const said: StoredDraft = { ...found, body }
  const next = held.map((one) => (one.id === id ? said : one))
  yield* store.saveDrafts(worktree.path, next)
  return reported(said)
})

export const dropDraft = Effect.fn("Cli.dropDraft")(function* (
  repo: string,
  branch: string,
  id: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  const held = yield* store.drafts(worktree.path)
  if (!held.some((one) => one.id === id)) return yield* new UnknownDraft({ id })
  yield* store.saveDrafts(
    worktree.path,
    held.filter((one) => one.id !== id),
  )
  return { dropped: id }
})

const sameCommit = (one: string, two: string): boolean => {
  const short = one.length <= two.length ? one : two
  const long = one.length <= two.length ? two : one
  return short.length > 0 && long.startsWith(short)
}

const commentOf = (draft: StoredDraft): ForgeComment => ({
  path: draft.anchor.path,
  start: draft.anchor.start,
  line: draft.anchor.end,
  side: draft.anchor.side,
  body: draft.body,
})

const sending = Effect.fn("Cli.sending")(function* (
  repo: string,
  branch: string,
  worktree: Worktree,
) {
  const store = yield* Store
  const forge = yield* Forge
  const held = yield* store.drafts(worktree.path)
  if (held.length === 0) return yield* new NothingDrafted({ branch })
  const head = yield* forge.head(repo, branch)
  if (!sameCommit(worktree.head, head)) {
    return yield* new PullMoved({ branch, was: worktree.head, now: head })
  }
  const sent = yield* forge.review(repo, branch, held.map(commentOf))
  const gone = new Set(sent.landed.map((at) => held[at]?.id))
  const kept = held.filter((one) => !gone.has(one.id))
  const asked = new Set(held.map((one) => one.id))
  const since = (yield* store.drafts(worktree.path)).filter((one) => !asked.has(one.id))
  const waiting = [...kept, ...since]
  yield* store.saveDrafts(worktree.path, waiting)
  if (kept.length > 0) {
    return yield* new PartlySent({
      branch,
      url: sent.url,
      sent: held.length - kept.length,
      held: waiting.length,
      landed: held.filter((one) => gone.has(one.id)).map((one) => one.id),
      kept: kept.map((one) => one.id),
    })
  }
  return { sent: held.length, url: sent.url, held: since.length } satisfies Dispatched
})

export const dispatchDrafts = Effect.fn("Cli.dispatchDrafts")(function* (
  repo: string,
  branch: string,
) {
  const store = yield* Store
  const worktree = yield* findBranch(repo, branch)
  return yield* store.whileHoldingDrafts(worktree.path, sending(repo, branch, worktree))
})
