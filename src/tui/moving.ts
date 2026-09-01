import { Effect } from "effect"
import type { Action } from "./command.ts"
import { type Clicked, onLayers } from "./model.ts"
import type { Work } from "./needs.ts"
import { atFile, atLayer, railScrolled, reduce, scrolled } from "./reduce.ts"
import { turnedTo } from "./source.ts"
import type { Terminal } from "./terminal.ts"

export const clicked = (app: Terminal, what: Clicked): Work => {
  return Effect.gen(function* () {
    const held = { ...app.measured(), focus: what.pane }
    if (what.entry !== undefined) {
      app.commit({ ...held, panelIndex: what.entry })
      return
    }
    if (what.layer !== undefined && onLayers(held)) {
      const was = held.patchIndex
      const moved = atLayer(held, what.layer)
      app.commit(what.file === undefined ? moved : atFile(moved, what.file))
      if (app.state.patchIndex !== was) yield* turnedTo(app)
      return
    }
    if (what.file === undefined || what.file === held.patchIndex) {
      app.commit(held)
      return
    }
    app.commit(atFile(held, what.file))
    yield* turnedTo(app)
  })
}

export const stepped = (app: Terminal, delta: number): Work => {
  return Effect.gen(function* () {
    if (paged(app, delta)) return
    catchUp(app)
    yield* commitSynced(app, delta > 0 ? "cursor.next" : "cursor.prev")
  })
}

export const catchUp = (app: Terminal): void => {
  const state = app.state
  if (state.screen !== "review" || state.focus !== "diff" || state.scroll < 0) return
  const last = state.scroll + Math.max(1, app.screen.viewportRows()) - 1
  const at = app.screen.screenRowOf(state.cursor) ?? last
  if (at >= state.scroll && at <= last) return
  const wanted = at < state.scroll ? state.scroll : last
  const top = app.screen.rowAtScreen(state.scroll)
  app.commit({ ...state, cursor: app.screen.rowAtScreen(wanted), stop: 0, top })
}

export const paged = (app: Terminal, delta: number): boolean => {
  if (app.state.screen !== "review" || app.state.focus !== "diff") return false
  const state = app.standing()
  const span = app.screen.blockAt(state.cursor, state.stop)
  const height = Math.max(1, state.viewport)
  if (span.rows <= height) return false
  const room = delta > 0 ? span.start + span.rows - height : span.start
  if (delta > 0 ? state.scroll >= room : state.scroll <= room) return false
  app.commit(scrolled(state, delta * Math.max(1, height - 2)))
  return true
}

export const commitSynced = (app: Terminal, action: Action): Work => {
  return Effect.gen(function* () {
    const was = app.state.patchIndex
    app.commit(reduce(app.measured(), action))
    if (app.state.patchIndex !== was) yield* turnedTo(app)
  })
}

export const rolled = (app: Terminal, delta: number): Work => {
  return Effect.gen(function* () {
    const was = app.state.patchIndex
    app.commit(railScrolled(app.measured(), delta))
    if (app.state.patchIndex !== was) yield* turnedTo(app)
  })
}

export const moveFile = (app: Terminal, delta: number): Work => {
  return commitSynced(app, delta > 0 ? "file.next" : "file.prev")
}

export const walkComments = (app: Terminal, delta: number): Work => {
  return Effect.gen(function* () {
    const was = app.state.patchIndex
    app.commit(reduce(app.measured(), delta > 0 ? "comment.next" : "comment.prev"))
    if (app.state.patchIndex !== was) yield* turnedTo(app)
  })
}
