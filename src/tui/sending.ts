import { Effect } from "effect"
import { loadHeld } from "./branches.ts"
import { dispatchDrafts } from "./comments.ts"
import { NOTHING_WRITTEN, sentAway } from "./drafts.ts"
import type { Work } from "./needs.ts"
import { worktreeOf } from "./reading.ts"
import { reduce, withNoticeHere } from "./reduce.ts"
import { selectedBranch, type TuiState } from "./state.ts"
import type { Terminal } from "./terminal.ts"
import { Draft } from "../review/index.ts"

const readUnderCursor = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    yield* loadHeld(app)
    const under = app.state.held[app.state.sendIndex]
    if (under?.id === undefined || under.rewritten !== true) return
    yield* Draft.markSeen(yield* worktreeOf(app, branch.branch), under.id, new Date().toISOString())
    yield* loadHeld(app)
  })
}

export const openSending = (app: Terminal): Work => {
  return Effect.gen(function* () {
    app.commit({ ...app.state, screen: "sending", returnTo: "review", sendIndex: 0, notice: "" })
    yield* readUnderCursor(app)
  })
}

export const movedInList = (app: Terminal, delta: number): Work => {
  return Effect.gen(function* () {
    app.commit(reduce(app.measured(), delta > 0 ? "send.next" : "send.prev"))
    yield* readUnderCursor(app)
  })
}

export const rewordHeld = (app: Terminal): Work => {
  return Effect.sync(() => {
    const under = app.state.held[app.state.sendIndex]
    if (under?.id === undefined) return
    app.commit({
      ...app.state,
      screen: "compose",
      returnTo: "sending",
      draft: under.body,
      draftAt: `reword:${under.id}`,
      replyTo: undefined,
      answerTo: undefined,
      about: undefined,
      reader: "author",
      editing: under.id,
    })
  })
}

export const REWORDED = "reworded"

const backInList = (state: TuiState): TuiState => ({ ...sentAway(state), editing: undefined })

export const rewordDraft = (app: Terminal, editing: string): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const body = app.screen.written()
    if (body.trim().length === 0) {
      app.commit(withNoticeHere(app.state, NOTHING_WRITTEN))
      return
    }
    const worktree = yield* worktreeOf(app, branch.branch)
    yield* Effect.ignore(Draft.edit(worktree, { id: editing, body, at: new Date().toISOString(), by: "reviewer" }))
    yield* loadHeld(app)
    app.commit(withNoticeHere(backInList(app.state), REWORDED))
  })
}

export const sendFromList = (app: Terminal): Work => dispatchDrafts(app)
