import { Effect } from "effect"
import { settleRead } from "../review/index.ts"
import { dropHeld } from "./comments.ts"
import type { Work } from "./needs.ts"
import {
  following,
  loadSent,
  remarksHeld,
  removing,
  restoring,
  settling,
  staying,
  unsettling,
} from "./reading.ts"
import { withNotice, withRemarks, withSent } from "./reduce.ts"
import { dismissRemarkHere } from "./remarks.ts"
import type { Terminal } from "./terminal.ts"
import { remarkUnderCursor, cursorOnThread, threadHere } from "./notes.ts"
import { panelEntry } from "./panel.ts"
import { selectedBranch } from "./state.ts"
import { counted } from "./words.ts"

export const settleWhatIsRead = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const done = yield* settleRead(app.repo, branch.branch, new Date().toISOString())
    if (done.settled === 0) {
      app.commit(withNotice(app.state, "nothing read is waiting to be settled"))
      return
    }
    const sent = yield* loadSent(app, branch.branch)
    const said = `settled ${counted(done.settled, "read comment")}`
    app.commit(withNotice(withSent(app.state, sent), said))
  })
}

export const settleHere = (app: Terminal): Work => {
  const thread = threadHere(app.state)
  const id = thread?.id
  if (selectedBranch(app.state) === undefined || id === undefined) {
    return Effect.sync(() => app.commit(withNotice(app.state, "no thread here")))
  }
  if (thread?.settled !== true) return changeSettled(app, id, false)
  if (!cursorOnThread(app.state)) {
    return Effect.sync(() =>
      app.commit(withNotice(app.state, "stand on the thread to take it back")),
    )
  }
  return changeSettled(app, id, true)
}

export const changeSettled = (app: Terminal, id: string, back: boolean): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const was = app.state.panelIndex
    yield* back ? unsettling(app, branch.branch, id) : settling(app, branch.branch, id)
    const sent = yield* loadSent(app, branch.branch)
    const opened = app.state.opened.filter((one) => one !== id)
    const held = withSent({ ...app.state, opened }, sent)
    const where = back ? following(held, id, was) : staying(held, was)
    app.commit(withNotice(where, back ? "unsettled" : "settled"))
  })
}

export const removeHere = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const waitingHeld = heldUnderCursor(app)
    const triaged = waitingHeld === -1 ? remarkUnderCursor(app.state) : undefined
    if (triaged !== undefined) {
      yield* dismissRemarkHere(app, triaged.remark, triaged.dismissed)
      return
    }
    const waiting = heldUnderCursor(app)
    if (waiting !== -1) {
      yield* dropHeld(app, waiting)
      return
    }
    const branch = selectedBranch(app.state)
    const thread = threadHere(app.state)
    const id = thread?.id
    if (branch === undefined || id === undefined) {
      app.commit(withNotice(app.state, "no thread here"))
      return
    }
    yield* turningOver(app, branch.branch, id, thread?.removed === true)
  })
}

export const turningOver = (app: Terminal, branch: string, id: string, back: boolean): Work => {
  return Effect.gen(function* () {
    const was = app.state.panelIndex
    yield* back ? restoring(app, branch, id) : removing(app, branch, id)
    const sent = yield* loadSent(app, branch)
    const kept = { ...app.state, opened: app.state.opened.filter((one) => one !== id) }
    const said = back ? "restored" : "removed, it is under Removed in the review"
    const held = app.reading
    const remarks = held === undefined ? app.state.remarks : yield* remarksHeld(app, held)
    app.commit(
      withNotice(staying(withRemarks(withSent(kept, sent), remarks), was), said),
    )
  })
}

export const heldUnderCursor = (app: Terminal): number => {
  if (app.state.focus !== "review") return -1
  const entry = panelEntry(app.state)
  if (entry === undefined || entry.kind !== "comment" || entry.section !== "held") return -1
  return app.state.held.indexOf(entry.comment)
}
