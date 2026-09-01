import { getTreeSitterClient, pathToFiletype } from "@opentui/core"
import { Effect } from "effect"
import type { Side } from "../domain/patch/index.ts"
import { fileBefore, fileSource, listPatches, patchIn, remarksAgainst } from "../review/index.ts"
import type { Action } from "./command.ts"
import { GAP_CHUNK, gapAtRow, shownOf } from "./gaps.ts"
import type { Work } from "./needs.ts"
import { worktreeFor } from "./reading.ts"
import {
  gapOpened,
  gapShown,
  reduce,
  withContext,
  withFull,
  withRemarks,
  withSource,
} from "./reduce.ts"
import type { Screen } from "./render.ts"
import type { Terminal } from "./terminal.ts"
import { rowAtSourceLine, sourceLineAt } from "./cursor.ts"
import { layerContext } from "./layerview.ts"
import { WHOLE_FILE } from "./layout.ts"
import { selectedBranch, selectedPatch, type TuiState } from "./state.ts"

const lonelyGaps = (state: TuiState): ReadonlyArray<{ index: number; hidden: number }> =>
  (shownOf(state)?.gaps ?? []).filter((gap) => gap.hidden === 1)

export const loadSource = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    const patch = selectedPatch(app.state)
    if (branch === undefined || patch === undefined) return
    const asked = patch.path
    const source = yield* fileSource(app.repo, branch.branch, asked)
    if (selectedPatch(app.state)?.path !== asked) return
    app.commit(withSource(app.state, source))
    const before = yield* fileBefore(app.repo, branch.branch, asked)
    if (selectedPatch(app.state)?.path !== asked) return
    yield* app.aside(app.lighting, lightUp(app.screen, asked, source, before))
    yield* openTinyGaps(app)
  })
}

export const turnedTo = (app: Terminal): Work => {
  return Effect.gen(function* () {
    app.commit(withSource(app.state, []))
    yield* app.aside(app.sourcing, loadSource(app))
  })
}

const light = (
  screen: Screen,
  path: string,
  side: Side,
  lines: ReadonlyArray<string>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const filetype = pathToFiletype(path) ?? "text"
    if (filetype === "text" || lines.length === 0) return
    const answer = yield* Effect.promise(() =>
      getTreeSitterClient().highlightOnce(lines.join("\n"), filetype),
    )
    if (answer.highlights !== undefined) screen.lit(path, side, lines, answer.highlights)
  })

const lightUp = (
  screen: Screen,
  path: string,
  source: ReadonlyArray<string>,
  before: ReadonlyArray<string>,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* light(screen, path, "new", source)
    if (before.length > 0) yield* light(screen, path, "old", before)
  })

export const openTinyGaps = (app: Terminal): Work => {
  return Effect.gen(function* () {
    if (lonelyGaps(app.state).length === 0) return
    yield* loadFull(app)
    const alone = lonelyGaps(app.state)
    if (alone.length === 0) return
    app.commit(alone.reduce((held, gap) => gapShown(held, gap.index, gap.hidden), app.state))
  })
}

export const loadFull = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    const patch = selectedPatch(app.state)
    if (branch === undefined || patch === undefined) return
    if (app.state.full.some((one) => one.path === patch.path)) return
    const worktree = worktreeFor(app, branch.branch)
    const full =
      worktree === undefined
        ? yield* listPatches(app.repo, branch.branch, WHOLE_FILE, patch.path)
        : yield* patchIn(worktree, WHOLE_FILE, patch.path)
    app.commit(withFull(app.state, [...app.state.full, ...full]))
  })
}

export const expand = (app: Terminal, delta: number): Work => {
  return widen(app, layerContext(app.state.context, delta))
}

export const widen = (app: Terminal, next: number): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined || next === app.state.context) return
    const line = sourceLineAt(app.state, app.state.cursor)
    const worktree = worktreeFor(app, branch.branch)
    const patches =
      worktree === undefined
        ? yield* listPatches(app.repo, branch.branch, next)
        : yield* patchIn(worktree, next)
    const widened = withContext(app.state, next, patches, 0)
    const patch = selectedPatch(widened)
    const cursor = patch === undefined || line === undefined ? 0 : rowAtSourceLine(patch, line)
    const held = app.reading
    const remarks =
      held === undefined
        ? app.state.remarks
        : yield* remarksAgainst(held.worktree.path, patches)
    app.commit(withRemarks(withContext(app.state, next, patches, cursor), remarks))
  })
}

export const unfold = (app: Terminal, delta: number): Work => {
  return Effect.gen(function* () {
    const gap =
      app.state.focus === "diff" ? gapAtRow(app.state, app.state.cursor) : undefined
    const action: Action = delta > 0 ? "tree.expand" : "tree.collapse"
    if (gap === undefined) {
      app.commit(reduce(app.measured(), action))
      return
    }
    if (delta > 0) yield* loadFull(app)
    app.commit(gapOpened(app.measured(), gap.index, delta * GAP_CHUNK))
  })
}
