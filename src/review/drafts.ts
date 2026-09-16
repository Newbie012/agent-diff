import { Effect } from "effect"
import { Forge, type ForgeComment } from "../service/forge/index.ts"
import { Store, type StoredDraft } from "../service/store/index.ts"
import { NothingDrafted, PartlySent, PullMoved, UnknownDraft } from "./error.ts"
import type { Side } from "../domain/patch/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { anchor } from "./patches.ts"

export type DraftRequest = {
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
  readonly snippet: string
  readonly at: string
  readonly wroteBy: "reviewer" | "agent"
  readonly unread: boolean
}

type Seen = Readonly<Record<string, string>>

const unreadIn = (draft: StoredDraft, seen: Seen): boolean => {
  if (draft.wroteBy !== "agent") return false
  const last = seen[draft.id]
  return last === undefined || last < draft.at
}

export type Dispatched = {
  readonly sent: number
  readonly url: string
  readonly held: number
}

const reported = (draft: StoredDraft, seen: Seen): ReportedDraft => ({
  id: draft.id,
  file: draft.anchor.path,
  side: draft.anchor.side,
  start: draft.anchor.start,
  end: draft.anchor.end,
  body: draft.body,
  snippet: draft.anchor.snippet,
  at: draft.at,
  wroteBy: draft.wroteBy,
  unread: unreadIn(draft, seen),
})

export const list = Effect.fn("Review.Draft.list")(function* (worktree: Worktree) {
  const store = yield* Store
  const seen = (yield* store.state(worktree.path)).seen
  return (yield* store.drafts(worktree.path)).map((one) => reported(one, seen))
})

export const markSeen = Effect.fn("Review.Draft.markSeen")(function* (
  worktree: Worktree,
  id: string,
  at: string,
) {
  const store = yield* Store
  yield* store.changeState(worktree.path, (current) => ({
    ...current,
    seen: { ...current.seen, [id]: at },
  }))
})

export const add = Effect.fn("Review.Draft.add")(function* (worktree: Worktree, request: DraftRequest) {
  const store = yield* Store
  const anchored = yield* anchor(worktree, request)
  const held = yield* store.drafts(worktree.path)
  const one: StoredDraft = {
    id: request.id,
    anchor: anchored,
    body: request.body,
    at: request.at,
    wroteBy: request.wroteBy,
  }
  yield* store.saveDrafts(worktree.path, [...held, one])
  return reported(one, {})
})

export type Rewrite = {
  readonly id: string
  readonly body: string
  readonly at: string
  readonly by: "reviewer" | "agent"
}

export const edit = Effect.fn("Review.Draft.edit")(function* (worktree: Worktree, rewrite: Rewrite) {
  const store = yield* Store
  const held = yield* store.drafts(worktree.path)
  const found = held.find((one) => one.id === rewrite.id)
  if (found === undefined) return yield* new UnknownDraft({ id: rewrite.id })
  const said: StoredDraft = { ...found, body: rewrite.body, at: rewrite.at, wroteBy: rewrite.by }
  const next = held.map((one) => (one.id === rewrite.id ? said : one))
  yield* store.saveDrafts(worktree.path, next)
  return reported(said, (yield* store.state(worktree.path)).seen)
})

export const drop = Effect.fn("Review.Draft.drop")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
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

const sending = Effect.fn("Review.Draft.sending")(function* (repo: string, worktree: Worktree) {
  const store = yield* Store
  const forge = yield* Forge
  const branch = worktree.branch
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

export const dispatch = Effect.fn("Review.Draft.dispatch")(function* (repo: string, worktree: Worktree) {
  const store = yield* Store
  return yield* store.whileHoldingDrafts(worktree.path, sending(repo, worktree))
})
