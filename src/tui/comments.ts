import { randomUUID } from "node:crypto"
import { Effect, Option } from "effect"
import { anchorFor } from "../domain/patch/index.ts"
import { type CommentRequest, markRead, submitReply } from "../review/index.ts"
import type { Work } from "./needs.ts"
import { commenting, loadSent, sending, staying } from "./reading.ts"
import { allRevealed, openedAt, reduce, withNotice, withNoticeHere, withSent } from "./reduce.ts"
import { openRemark, sendRemarkAnswer } from "./remarks.ts"
import { turnedTo } from "./source.ts"
import type { Terminal } from "./terminal.ts"
import { holding, NOTHING_WRITTEN, sentAway } from "./drafts.ts"
import { rowShowing, selectionRange } from "./cursor.ts"
import { remarkHere, threadHere } from "./notes.ts"
import { panelEntry, type PanelEntry } from "./panel.ts"
import { selectedBranch, selectedPatch, type StagedComment, type TuiState } from "./state.ts"
import { counted } from "./words.ts"

const LAYERS_ASK_LEAD = "About this branch, not about this line."

const layersAsk = (state: TuiState): string => {
  if (state.layers.length === 0) {
    return `${LAYERS_ASK_LEAD} Please write a reading order for it with \`adiff layers set\`, so the diff can be read in the order the change was made rather than by filename.`
  }
  if (state.layersStale) {
    return `${LAYERS_ASK_LEAD} The reading order on it describes an older commit — please read the diff again and write a new one with \`adiff layers set\`.`
  }
  return `${LAYERS_ASK_LEAD} Please revise its reading order with \`adiff layers set\`.`
}

const askedFor = (state: TuiState): string =>
  state.layers.length === 0 ? "asked for a reading order" : "asked for a new reading order"

export const compose = (app: Terminal): Work => {
  return Effect.gen(function* () {
    if (app.state.focus !== "review") {
      app.commit(reduce(app.measured(), "compose.open"))
      return
    }
    yield* openPanelEntry(app)
  })
}

export const openPanelEntry = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const entry = panelEntry(app.state)
    if (entry === undefined) {
      app.commit(withNoticeHere(app.state, "nothing in the review yet"))
      return
    }
    if (entry.kind === "fold") {
      app.commit({ ...app.state, openMoved: !entry.open })
      return
    }
    if (entry.kind === "remark") {
      yield* openRemark(app, entry.remark)
      return
    }
    const at = app.state.patches.findIndex((patch) => patch.path === entry.comment.file)
    const patch = app.state.patches[at]
    if (patch === undefined) {
      yield* readAnswers(app, entry.comment.id)
      app.commit(withNoticeHere(app.state, `${entry.comment.file} is not on this branch`))
      return
    }
    const opened = { ...app.measured(), patchIndex: at }
    const shown = selectedPatch(opened)
    if (shown !== undefined && rowShowing(shown, entry.comment.end) === undefined) {
      yield* jumpingPastGaps(app, opened, at, entry)
      return
    }
    app.commit(openedAt(app.measured(), at, entry.comment.end))
    yield* turnedTo(app)
    yield* readAnswers(app, entry.comment.id)
  })
}

export const jumpingPastGaps = (app: Terminal, opened: TuiState,
  at: number,
  entry: Extract<PanelEntry, { kind: "comment" }>,): Work => {
  return Effect.gen(function* () {
    const wide = { ...opened, revealed: allRevealed(opened) }
    const shown = selectedPatch(wide)
    if (shown === undefined || rowShowing(shown, entry.comment.end) === undefined) {
      yield* readAnswers(app, entry.comment.id)
      const said = withNoticeHere(app.state, "the diff no longer has that line")
      app.commit({ ...said, screen: "thread", returnTo: said.screen })
      return
    }
    app.commit(openedAt({ ...app.measured(), revealed: wide.revealed }, at, entry.comment.end))
    yield* turnedTo(app)
    yield* readAnswers(app, entry.comment.id)
  })
}

export const readAnswers = (app: Terminal, id: string | undefined): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (id === undefined || branch === undefined) return
    yield* markRead(app.repo, branch.branch, id)
    const held = app.state.panelIndex
    const sent = yield* loadSent(app, branch.branch)
    app.commit({ ...withSent(app.state, sent), panelIndex: held })
  })
}

export const send = (app: Terminal): Work => {
  if (app.state.answerTo !== undefined) return sendRemarkAnswer(app, app.state.answerTo)
  return app.state.replyTo === undefined ? sendComment(app) : sendReply(app, app.state.replyTo)
}

export const sendReply = (app: Terminal, to: string): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    if (app.state.draft.trim().length === 0) {
      app.commit(withNotice(app.state, NOTHING_WRITTEN))
      return
    }
    yield* submitReply({
      repo: app.repo,
      branch: branch.branch,
      to,
      body: app.screen.written(),
      id: randomUUID(),
      at: new Date().toISOString(),
    })
    const sent = yield* loadSent(app, branch.branch)
    app.commit(withNotice(sentAway(withSent(app.state, sent)), "sent to the agent"))
  })
}

export const sendComment = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const patch = selectedPatch(app.state)
    const branch = selectedBranch(app.state)
    const [from, to] = selectionRange(app.state)
    if (patch === undefined || branch === undefined) return
    if (app.state.draft.trim().length === 0) {
      app.commit(withNotice(app.state, NOTHING_WRITTEN))
      return
    }
    const anchor = anchorFor(patch, from, to)
    if (Option.isNone(anchor)) {
      app.commit(withNotice(app.state, "nothing selected"))
      return
    }
    const body = app.screen.written()
    if (app.state.hold) {
      holding(app, {
        file: patch.path,
        side: anchor.value.side,
        start: anchor.value.start,
        end: anchor.value.end,
        body,
      })
      return
    }
    yield* commenting(app, branch.branch, {
      repo: app.repo,
      branch: branch.branch,
      file: patch.path,
      side: anchor.value.side,
      start: anchor.value.start,
      end: anchor.value.end,
      body,
      id: randomUUID(),
      at: new Date().toISOString(),
    })
    const sent = yield* loadSent(app, branch.branch)
    app.commit(withNotice(sentAway(withSent(app.state, sent)), "sent to the agent"))
  })
}

export const dropHeld = (app: Terminal, at: number): Work => {
  return Effect.sync(() => {
    const was = app.state.panelIndex
    const held = app.state.held.filter((_, index) => index !== at)
    app.commit(withNotice(staying({ ...app.state, held }, was), "dropped, it was never sent"))
  })
}

export const sendHeld = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    const [first, ...rest] = app.state.held
    if (branch === undefined || first === undefined) return
    const at = new Date().toISOString()
    const asked = (comment: StagedComment): CommentRequest => ({
      repo: app.repo,
      branch: branch.branch,
      file: comment.file,
      side: comment.side,
      start: comment.start,
      end: comment.end,
      body: comment.body,
      id: randomUUID(),
      at,
      ...(comment.remark === undefined ? {} : { remark: comment.remark }),
    })
    const many = app.state.held.length
    yield* sending(app, branch.branch, [asked(first), ...rest.map(asked)])
    const sent = yield* loadSent(app, branch.branch)
    app.commit(
      withNotice(
        withSent({ ...app.state, held: [] }, sent),
        `sent ${counted(many, "comment")} to the agent`,
      ),
    )
  })
}

export const askForLayers = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const patch = app.state.patches[0]
    const branch = selectedBranch(app.state)
    if (patch === undefined || branch === undefined) return
    yield* commenting(app, branch.branch, {
      repo: app.repo,
      branch: branch.branch,
      file: patch.path,
      side: "new",
      start: 1,
      end: 1,
      body: layersAsk(app.state),
      id: randomUUID(),
      at: new Date().toISOString(),
    })
    const sent = yield* loadSent(app, branch.branch)
    app.commit(withNotice(withSent(app.state, sent), askedFor(app.state)))
  })
}

export const replyHere = (app: Terminal): Work => {
  return Effect.sync(() => {
    const thread = threadHere(app.state)
    if (thread?.id !== undefined) {
      app.commit({ ...app.state, screen: "compose", draft: "", replyTo: thread.id })
      return
    }
    const remark = remarkHere(app.state)
    if (remark === undefined) {
      app.commit(withNotice(app.state, "no thread here"))
      return
    }
    app.commit({ ...app.state, screen: "compose", draft: "", answerTo: remark.id })
  })
}
