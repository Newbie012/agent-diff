import { Effect } from "effect"
import {
  Branch,
  Comment,
  Remark,
  type BranchReading,
  type ReportedRemark,
} from "../review/index.ts"
import type { Worktree } from "../service/git/index.ts"
import type { Work } from "./needs.ts"
import { panelEntries } from "./panel.ts"
import type { TuiState } from "./state.ts"
import type { Terminal } from "./terminal.ts"

const readingHeld = (app: Terminal, branch: string): BranchReading | undefined => {
  const reading = app.reading
  return reading === undefined || reading.worktree.branch !== branch ? undefined : reading
}

export const worktreeFor = (app: Terminal, branch: string): Worktree | undefined =>
  readingHeld(app, branch)?.worktree

export const worktreeOf = (app: Terminal, branch: string): Work<Worktree> => {
  const held = worktreeFor(app, branch)
  return held === undefined ? Branch.find(app.repo, branch) : Effect.succeed(held)
}

export const readingOf = (app: Terminal, branch: string): Work<BranchReading> => {
  const held = readingHeld(app, branch)
  return held === undefined ? Branch.reading(app.repo, branch) : Effect.succeed(held)
}

export const loadSent = (app: Terminal, branch: string): Work<TuiState["sent"]> =>
  Effect.flatMap(readingOf(app, branch), Comment.listSent)

export const remarksHeld = (
  app: Terminal,
  reading: BranchReading,
): Work<ReadonlyArray<ReportedRemark>> =>
  app.state.remarksOn ? Remark.list(reading) : Effect.succeed([])

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
