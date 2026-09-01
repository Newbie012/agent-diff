import { Effect, FiberHandle } from "effect"
import { aroundIn, searchBranch, searchIn } from "../review/index.ts"
import type { Work } from "./needs.ts"
import {
  allRevealed,
  atFile,
  reduce,
  withAround,
  withFinder,
  withMatches,
  withNoticeHere,
} from "./reduce.ts"
import { loadSource } from "./source.ts"
import type { Terminal } from "./terminal.ts"
import { matchHere, pickedText, rowAtSourceLine, rowShowing } from "./cursor.ts"
import { selectedBranch, selectedPatch } from "./state.ts"

export const LEAST_TERM = 2

const NOTHING_COUNTED = { file: 0, branch: 0, worktree: 0 }

const seedFor = (picked: string | undefined): string => picked?.trim() ?? ""

export const findSelection = (app: Terminal): Work => {
  return Effect.sync(() => {
    const seed = seedFor(pickedText(app.state))
    app.commit(withFinder(app.state, seed))
    app.screen.askWith(seed)
  })
}

export const forgetMatches = (app: Terminal): Work => {
  return Effect.sync(() =>
    app.commit(
      withMatches(app.state, { matches: [], counted: NOTHING_COUNTED, left: 0 }, ""),
    ),
  )
}

export const runFinder = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const wanted = app.state.query.trim()
    if (wanted.length < LEAST_TERM) return
    if (wanted !== app.state.term) {
      yield* FiberHandle.clear(app.looking)
      yield* lookFor(app, wanted)
      return
    }
    yield* openMatch(app)
  })
}

export const searchAside = (app: Terminal, wanted: string): Work => {
  return Effect.gen(function* () {
    yield* app.aside(app.searching, lookFor(app, wanted))
  })
}

export const lookFor = (app: Terminal, wanted: string): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const reading = app.reading
    const here = selectedPatch(app.state)?.path ?? ""
    const found =
      reading === undefined || reading.worktree.branch !== branch.branch
        ? yield* searchBranch(app.repo, branch.branch, wanted, here)
        : yield* searchIn(reading, wanted, here)
    if (app.state.screen !== "search" || app.state.query.trim() !== wanted) return
    app.commit(withMatches(app.state, found, wanted))
    yield* readAround(app)
  })
}

export const readAround = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const reading = app.reading
    const match = matchHere(app.state)
    if (reading === undefined || match === undefined) return
    const lines = yield* aroundIn(reading, match.path, match.line)
    const still = matchHere(app.state)
    if (still?.path !== match.path || still.line !== match.line) return
    app.commit(withAround(app.state, lines))
  })
}

export const openMatch = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const match = matchHere(app.state)
    if (match === undefined) return
    const at = app.state.patches.findIndex((patch) => patch.path === match.path)
    const patch = app.state.patches[at]
    if (patch === undefined) {
      app.commit(withNoticeHere(app.state, `${match.path} is not changed on this branch`))
      return
    }
    const landed = atFile({ ...app.state, screen: "review", matches: [], term: "" }, at)
    const shown = selectedPatch(landed)
    const showing = shown !== undefined && rowShowing(shown, match.line) !== undefined
    const opened = showing ? landed : { ...landed, revealed: allRevealed(landed) }
    const found = selectedPatch(opened) ?? patch
    app.commit({ ...opened, cursor: rowAtSourceLine(found, match.line) })
    yield* loadSource(app)
  })
}

export const walkMatches = (app: Terminal, delta: number): Work => {
  return Effect.gen(function* () {
    app.commit(reduce(app.measured(), delta > 0 ? "match.next" : "match.prev"))
    yield* readAround(app)
  })
}
