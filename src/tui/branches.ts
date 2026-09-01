import { Effect, Option, Result } from "effect"
import {
  clearBase,
  layersIn,
  listBranches,
  listRefs,
  markOpened,
  progressIn,
  readingOf,
  recentBases,
  type Remark,
  remarksHeldIn,
  sentIn,
  setBase,
} from "../review/index.ts"
import { Forge } from "../service/forge/index.ts"
import {
  knownToHaveNoPull,
  pullHere,
  refHere,
  selectedBranch,
  selectedPatch,
  sourceLineAt,
  spokenSince,
  type TuiState,
} from "./model.ts"
import type { Work } from "./needs.ts"
import { loadSent } from "./reading.ts"
import {
  reduce,
  restoredTo,
  resumedAt,
  withArrived,
  withBranches,
  withLayers,
  withNotice,
  withNoticeHere,
  withPatches,
  withPulls,
  withRefs,
  withRemarks,
  withSent,
  withSilentForge,
  withVouched,
  withWaiting,
} from "./reduce.ts"
import { fetchRemarks } from "./remarks.ts"
import type { Session } from "./session.ts"
import { loadSource } from "./source.ts"
import type { Terminal } from "./terminal.ts"

const openedPull = (state: string, opened: boolean): string => {
  if (!opened) return "could not reach the pull request"
  return state.length === 0 ? "opened the pull request" : `opened the ${state} pull request`
}

export const openedOn = (app: Terminal, branchIndex: number): Work => {
  return Effect.gen(function* () {
    if (branchIndex >= app.state.branches.length) return
    app.write({ ...app.state, branchIndex })
    yield* openBranch(app)
    yield* loadSource(app)
  })
}

export const resumeAt = (app: Terminal, session: Session): Work => {
  return Effect.gen(function* () {
    const branches = app.state.branches
    if (session.branchIndex >= branches.length) return
    app.write({ ...app.state, branchIndex: session.branchIndex })
    yield* openBranch(app)
    const patchIndex = Math.min(session.patchIndex, Math.max(0, app.state.patches.length - 1))
    app.commit(resumedAt(app.state, patchIndex, session.cursor, session.top))
    yield* loadSource(app)
  })
}

export const openBranch = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    app.commit(yield* readBranch(app, branch.branch))
    yield* fetchRemarks(app)
    yield* loadSource(app)
  })
}

export const readBranch = (app: Terminal, name: string): Work<TuiState> => {
  return Effect.gen(function* () {
    const reading = yield* readingOf(app.repo, name, app.base)
    app.reading = reading
    yield* markOpened(reading.worktree.path, new Date().toISOString())
    const [progress, layers, sent, remarks] = yield* Effect.all(
      [
        progressIn(reading),
        layersIn(reading),
        sentIn(reading),
        app.state.remarksOn
          ? remarksHeldIn(reading)
          : Effect.succeed([] as ReadonlyArray<Remark>),
      ],
      { concurrency: "unbounded" },
    )
    const opened = withVouched(withPatches(app.state, reading.patches), progress.vouched)
    return withRemarks(withLayers(withSent(opened, sent), layers), remarks)
  })
}

export const fillBranches = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const here = selectedBranch(app.state)?.branch
    const branches = yield* listBranches(app.repo, app.base)
    const read = withBranches(app.state, branches)
    const at = branches.findIndex((candidate) => candidate.branch === here)
    app.commit(at === -1 ? read : { ...read, branchIndex: at })
    app.dispatch(loadPulls(app))
  })
}

export const reloadList = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const here = selectedBranch(app.state)?.branch
    const branches = yield* listBranches(app.repo, app.base)
    const read = withBranches(app.state, branches)
    const at = branches.findIndex((candidate) => candidate.branch === here)
    const kept = at === -1 ? read : { ...read, branchIndex: at }
    app.commit(withWaiting(withNoticeHere(kept, "read the list again"), ""))
    app.dispatch(loadPulls(app))
  })
}

export const reloadBranch = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const path = selectedPatch(app.state)?.path
    const line = sourceLineAt(app.state, app.state.cursor)
    const offset = app.state.cursor - app.state.top
    const read = yield* readBranch(app, branch.branch)
    const held = restoredTo(read, path, line, offset)
    app.commit(withWaiting(withNotice(held, "read the branch again"), ""))
    yield* fetchRemarks(app)
    yield* loadSource(app)
  })
}

export const goBack = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const next = reduce(app.measured(), "back")
    app.commit(next)
    if (next.screen !== "branches") return
    app.commit(withBranches(app.state, yield* (listBranches(app.repo, app.base))))
  })
}

export const loadPulls = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const forge = yield* Forge
    const answered = yield* (
      forge.pulls(app.repo).pipe(
        Effect.map(Option.some),
        Effect.catchTag("ForgeUnavailable", () => Effect.succeed(Option.none())),
      )
    )
    app.commit(
      Option.match(answered, {
        onNone: () => withSilentForge(app.state),
        onSome: (pulls) =>
          withPulls(app.state, Object.fromEntries(pulls.map((pull) => [pull.branch, pull.state]))),
      }),
    )
  })
}

export const showPull = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    if (pullHere(app.state).length === 0) yield* loadPulls(app)
    if (knownToHaveNoPull(app.state)) {
      app.commit(withNoticeHere(app.state, "no pull request for this branch"))
      return
    }
    const forge = yield* Forge
    const asked = forge.openPull(app.repo, branch.branch)
    const opened = yield* (
      asked.pipe(
        Effect.as(true),
        Effect.catchTag("ForgeUnavailable", () => Effect.succeed(false)),
      )
    )
    app.commit(withNoticeHere(app.state, openedPull(pullHere(app.state), opened)))
  })
}

export const openBases = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const [refs, recent] = yield* Effect.all([
      listRefs(app.repo),
      recentBases(app.repo, branch.branch),
    ])
    const said = Object.fromEntries(recent.map((one) => [one.ref, one.said]))
    const kept = refs.filter((ref) => ref !== branch.branch)
    app.commit(withRefs(app.state, [...recent.map((one) => one.ref), ...kept], said))
  })
}

export const basedOnRef = (app: Terminal, ref: string): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const held = yield* Effect.result(setBase(app.repo, branch.branch, ref))
    if (Result.isFailure(held)) {
      app.commit(withNotice(app.state, `${ref} names nothing here`))
      return
    }
    yield* afterBase(app, branch.branch, `based on ${ref}`)
  })
}

export const clearBaseHere = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    yield* clearBase(app.repo, branch.branch)
    yield* afterBase(app, branch.branch, "the base is adiff's guess again")
  })
}

export const afterBase = (app: Terminal, branch: string, said: string): Work => {
  return Effect.gen(function* () {
    const listed = yield* listBranches(app.repo, app.base)
    const back = { ...app.state, screen: app.state.returnTo, query: "" }
    const held = withBranches(back, listed)
    const at = listed.findIndex((one) => one.branch === branch)
    app.commit(withNotice(at === -1 ? held : { ...held, branchIndex: at }, said))
    if (app.state.screen !== "review") return
    app.commit(yield* readBranch(app, branch))
    yield* fetchRemarks(app)
    yield* loadSource(app)
  })
}

export const setBaseHere = (app: Terminal): Work => {
  const ref = refHere(app.state)
  return ref === undefined ? Effect.void : basedOnRef(app, ref)
}

export const noticeAnswers = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) {
      yield* noticeOnList(app)
      return
    }
    const sent = yield* loadSent(app, branch.branch)
    const said = spokenSince(app.state.sent, sent)
    if (said === 0) return
    app.commit(withWaiting(withArrived(app.state, sent), `${said} answered · press r`))
  })
}

export const noticeOnList = (app: Terminal): Work => {
  return Effect.sync(() => app.commit(withWaiting(app.state, "the agent answered · press r")))
}
