import { Effect } from "effect"
import type { VouchReport } from "../review/index.ts"
import {
  isReviewed,
  layersHolding,
  nextUnreviewed,
  onLayers,
  partHere,
  readIn,
  selectedBranch,
  selectedPatch,
  type StagedComment,
  threadsInLayer,
  threadsOpenOn,
  type TuiState,
  withAsking,
} from "./model.ts"
import type { Work } from "./needs.ts"
import { loadSent, settling } from "./reading.ts"
import { atFile, reduce, withNotice, withSent, withVouched } from "./reduce.ts"
import type { Terminal } from "./terminal.ts"
import { toggleVouch, vouchIn, vouchPartIn } from "../review/index.ts"

const alongFrom = (state: TuiState): TuiState => {
  const along = nextUnreviewed(state, state.patchIndex)
  return along === undefined ? withNotice(state, "every file reviewed") : atFile(state, along)
}

const markedIs = (path: string, settled: number): string =>
  settled === 0
    ? `marked ${path}`
    : `marked ${path} and settled ${settled} thread${settled === 1 ? "" : "s"}`

export const vouch = (app: Terminal, advance: boolean): Work => {
  return Effect.gen(function* () {
    const patch = selectedPatch(app.state)
    const branch = selectedBranch(app.state)
    if (patch === undefined || branch === undefined) return
    if (advance && readHere(app)) {
      app.commit(alongFrom(app.state))
      return
    }
    const open = readHere(app) ? [] : threadsToAsk(app)
    const threads = open.flatMap((entry) => (entry.id === undefined ? [] : [entry.id]))
    if (threads.length === 0) {
      yield* marking(app, { path: patch.path, advance, settled: 0, named: patch.path })
      return
    }
    const layer = layerAsked(app, threads.length)
    app.commit(withAsking(app.measured(), { path: patch.path, layer, threads, advance }))
  })
}

export const layerAsked = (app: Terminal, asked: number): string | undefined => {
  if (partHereNow(app) === undefined) return undefined
  const inside = threadsInLayer(app.state, app.state.patchIndex, app.state.layerIndex).length
  if (inside !== asked) return undefined
  return app.state.layers[app.state.layerIndex]?.title
}

export const threadsToAsk = (app: Terminal): ReadonlyArray<StagedComment> => {
  const layered = partHereNow(app) === undefined ? undefined : app.state.layerIndex
  return threadsOpenOn(app.state, app.state.patchIndex, layered)
}

export const tookTheAnswer = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const asking = app.state.asking
    const branch = selectedBranch(app.state)
    if (asking === undefined || branch === undefined) return
    const settles = app.state.askIndex === 0
    const named = asking.layer ?? asking.path
    if (settles) yield* settleThese(app, branch.branch, asking.threads)
    app.commit(reduce(app.measured(), "back"))
    yield* marking(app, { path: asking.path, advance: asking.advance, settled: settles ? asking.threads.length : 0, named })
  })
}

export const settleThese = (app: Terminal, branch: string, ids: ReadonlyArray<string>): Work => {
  return Effect.gen(function* () {
    for (const id of ids) yield* settling(app, branch, id)
    const sent = yield* loadSent(app, branch)
    app.commit(withSent(app.state, sent))
  })
}

type Marking = {
  readonly path: string
  readonly advance: boolean
  readonly settled: number
  readonly named: string
}

export const marking = (app: Terminal, asked: Marking): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const report = yield* vouching(app, branch.branch, asked.path)
    const next = withVouched(app.state, report.vouched, report.parts)
    if (!asked.advance) {
      app.commit(withNotice(next, markedSaid(app, report, asked)))
      return
    }
    movedOn(app, next, asked.named, asked.settled)
  })
}

export const markedSaid = (app: Terminal, report: VouchReport, asked: Marking): string => {
  const part = partHereNow(app)
  const marked = part === undefined ? report.vouched.includes(asked.path) : report.parts.includes(part)
  return marked ? markedIs(asked.named, asked.settled) : `unmarked ${asked.named}`
}

export const movedOn = (app: Terminal, next: TuiState, path: string, settled: number): void => {
  const said = markedIs(path, settled)
  const target = nextUnreviewed(next, next.patchIndex)
  if (target === undefined) {
    const done = settled === 0 ? "every file reviewed" : `${said}, and every file reviewed`
    app.commit(withNotice(next, done))
    return
  }
  app.commit(withNotice(atFile(next, target), said))
}

export const readHere = (app: Terminal): boolean => {
  return onLayers(app.state)
    ? readIn(app.state, app.state.layerIndex, app.state.patchIndex)
    : isReviewed(app.state, app.state.patchIndex)
}

export const partHereNow = (app: Terminal): string | undefined => {
  if (!onLayers(app.state) || layersHolding(app.state, app.state.patchIndex) < 2) {
    return undefined
  }
  return partHere(app.state, app.state.layerIndex, app.state.patchIndex)
}

export const vouching = (app: Terminal, branch: string, file: string): Work<VouchReport> => {
  const held = app.reading
  if (held === undefined || held.worktree.branch !== branch) {
    return toggleVouch({ repo: app.repo, branch, file })
  }
  const part = partHereNow(app)
  return part === undefined ? vouchIn(held, file) : vouchPartIn(held, file, part)
}
