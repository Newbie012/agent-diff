import { Effect } from "effect"
import {
  type BranchReading,
  commentIn,
  type CommentRequest,
  commentsIn,
  listSent,
  type Remark,
  remarksHeldIn,
  removeComment,
  removeIn,
  restoreComment,
  restoreIn,
  sentIn,
  settleIn,
  submitComment,
  submitComments,
  unsettleIn,
  unsettleThread,
  type Written,
} from "../review/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { panelEntries, type TuiState } from "./model.ts"
import type { Work } from "./needs.ts"
import type { Terminal } from "./terminal.ts"
import { settleThread } from "../review/index.ts"

export const worktreeFor = (app: Terminal, branch: string): Worktree | undefined => {
  const reading = app.reading
  return reading === undefined || reading.worktree.branch !== branch ? undefined : reading.worktree
}

export const loadSent = (app: Terminal, branch: string): Work<TuiState["sent"]> => {
  const reading = app.reading
  return reading === undefined || reading.worktree.branch !== branch
    ? listSent(app.repo, branch)
    : sentIn(reading)
}

export const commenting = (app: Terminal, branch: string, request: CommentRequest): Work<unknown> => {
  const worktree = worktreeFor(app, branch)
  return worktree === undefined ? submitComment(request) : commentIn(worktree, request)
}

export const sending = (app: Terminal, branch: string, requests: Written): Work<unknown> => {
  const worktree = worktreeFor(app, branch)
  return worktree === undefined ? submitComments(requests) : commentsIn(worktree, requests)
}

export const settling = (app: Terminal, branch: string, id: string): Work<{ readonly settled: string }> => {
  const at = new Date().toISOString()
  const worktree = worktreeFor(app, branch)
  return worktree === undefined
    ? settleThread(app.repo, branch, id, at)
    : settleIn(worktree, id, at)
}

export const unsettling = (app: Terminal, branch: string, id: string): Work<{ readonly unsettled: string }> => {
  const worktree = worktreeFor(app, branch)
  return worktree === undefined
    ? unsettleThread(app.repo, branch, id)
    : unsettleIn(worktree, id)
}

export const restoring = (app: Terminal, branch: string, id: string): Work<{ readonly restored: string }> => {
  const worktree = worktreeFor(app, branch)
  return worktree === undefined
    ? restoreComment(app.repo, branch, id)
    : restoreIn(worktree, id)
}

export const removing = (app: Terminal, branch: string, id: string): Work<{ readonly removed: string }> => {
  const at = new Date().toISOString()
  const worktree = worktreeFor(app, branch)
  return worktree === undefined
    ? removeComment(app.repo, branch, id, at)
    : removeIn(worktree, id, at)
}

export const remarksHeld = (app: Terminal, reading: BranchReading): Work<ReadonlyArray<Remark>> => {
  return app.state.remarksOn
    ? remarksHeldIn(reading)
    : Effect.succeed([] as ReadonlyArray<Remark>)
}

export const staying = (state: TuiState, was: number): TuiState => {
  const last = Math.max(0, panelEntries(state).length - 1)
  return { ...state, panelIndex: Math.min(was, last) }
}

export const following = (state: TuiState, id: string, was: number): TuiState => {
  if (state.focus !== "review") return staying(state, was)
  const at = panelEntries(state).findIndex(
    (entry) => entry.kind === "comment" && entry.comment.id === id,
  )
  return at === -1 ? staying(state, was) : { ...state, panelIndex: at }
}
