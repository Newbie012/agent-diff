import { randomUUID } from "node:crypto"
import { Effect, Result } from "effect"
import {
  acceptIn,
  answerRemark,
  type BranchReading,
  dismissIn,
  quoted,
  type Remark,
  remarksIn,
  sentIn,
  undismissIn,
} from "../review/index.ts"
import { remarkHere, selectedBranch } from "./model.ts"
import type { Work } from "./needs.ts"
import { remarksHeld, staying } from "./reading.ts"
import {
  openedAt,
  withNotice,
  withNoticeHere,
  withRemarks,
  withSent,
  withWaiting,
} from "./reduce.ts"
import { turnedTo } from "./source.ts"
import type { Terminal } from "./terminal.ts"
import { holding, NOTHING_WRITTEN } from "./drafts.ts"
import { sentAway } from "./drafts.ts"

const READING_PULL = "reading the pull request"
const FORGE_QUIET = "the forge did not answer, so no remarks are shown"

export const fetchRemarks = (app: Terminal): Work => {
  return Effect.gen(function* () {
    if (!app.state.remarksOn || app.reading === undefined) return
    yield* app.aside(app.fetching, readRemarks(app, app.reading))
  })
}

export const readRemarks = (app: Terminal, reading: BranchReading): Work => {
  return Effect.gen(function* () {
    const said = app.state.waiting
    app.commit(withWaiting(app.state, READING_PULL))
    const found = yield* Effect.result(remarksIn(app.repo, reading))
    if (app.reading !== reading) return
    const rested = withWaiting(app.state, said)
    const hasPull = (app.state.pulls[reading.worktree.branch] ?? "").length > 0
    if (Result.isFailure(found)) {
      app.commit(hasPull ? withNoticeHere(rested, FORGE_QUIET) : rested)
      return
    }
    app.commit(withRemarks(rested, found.success))
  })
}

export const openRemark = (app: Terminal, remark: Remark): Work => {
  return Effect.gen(function* () {
    const at = app.state.patches.findIndex((patch) => patch.path === remark.file)
    const patch = app.state.patches[at]
    if (patch === undefined || !remark.placed) {
      app.commit(withNoticeHere(app.state, `${remark.file} is not in this diff`))
      return
    }
    app.commit(openedAt(app.measured(), at, remark.end))
    yield* turnedTo(app)
  })
}

export const acceptRemarkHere = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const remark = remarkHere(app.state)
    const reading = app.reading
    if (remark === undefined || reading === undefined) {
      app.commit(withNoticeHere(app.state, "no remark here"))
      return
    }
    if (app.state.hold) {
      holding(app, {
        file: remark.file,
        side: remark.side,
        start: remark.start,
        end: remark.end,
        body: quoted(remark),
        remark: remark.id,
      })
      return
    }
    const done = yield* Effect.as(
      acceptIn({
        reading,
        id: remark.id,
        at: new Date().toISOString(),
        commentId: randomUUID(),
      }),
      true,
    ).pipe(Effect.catchTag("RemarkTaken", () => Effect.succeed(false)))
    if (!done) {
      app.commit(withNoticeHere(app.state, "that remark is already a comment of yours"))
      return
    }
    yield* reloadRemarks(app, "accepted, the agent has it")
  })
}

export const dismissRemarkHere = (app: Terminal, remark: Remark, back: boolean): Work => {
  return Effect.gen(function* () {
    const reading = app.reading
    if (reading === undefined) return
    const at = new Date().toISOString()
    yield* back
      ? undismissIn(reading.worktree.path, remark.id)
      : dismissIn(reading.worktree.path, remark.id, at)
    yield* reloadRemarks(app, back ? "restored" : "dismissed, it is under Dismissed")
  })
}

export const reloadRemarks = (app: Terminal, said: string): Work => {
  return Effect.gen(function* () {
    const reading = app.reading
    if (reading === undefined) return
    const [remarks, sent] = yield* Effect.all([remarksHeld(app, reading), sentIn(reading)], {
      concurrency: "unbounded",
    })
    const held = staying(withRemarks(withSent(app.state, sent), remarks), app.state.panelIndex)
    app.commit(withNoticeHere(held, said))
  })
}

export const reloadFromForge = (app: Terminal, said: string): Work => {
  return Effect.gen(function* () {
    const reading = app.reading
    if (reading === undefined) return
    const remarks = yield* Effect.orElseSucceed(
      remarksIn(app.repo, reading),
      () => app.state.remarks,
    )
    app.commit(withNoticeHere(withRemarks(app.state, remarks), said))
  })
}

export const sendRemarkAnswer = (app: Terminal, to: string): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    if (app.state.draft.trim().length === 0) {
      app.commit(withNotice(app.state, NOTHING_WRITTEN))
      return
    }
    const said = app.screen.written()
    const done = yield* Effect.as(
      answerRemark({ repo: app.repo, branch: branch.branch, id: to, body: said }),
      true,
    ).pipe(Effect.catchTag("ForgeUnavailable", () => Effect.succeed(false)))
    const clear = { ...sentAway(app.state), answerTo: undefined }
    if (!done) {
      app.commit(withNotice(clear, "the forge would not take that reply"))
      return
    }
    app.commit(clear)
    yield* reloadFromForge(app, "replied on the pull request")
  })
}
