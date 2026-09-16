import { randomUUID } from "node:crypto"
import { Effect, Option } from "effect"
import { anchorFor } from "../domain/patch/index.ts"
import type { Work } from "./needs.ts"
import { allRevealed, openedAt, reduce, withNotice, withNoticeHere, withSent } from "./reduce.ts"
import { openRemark, sendRemarkAnswer } from "./remarks.ts"
import { turnedTo } from "./source.ts"
import type { Terminal } from "./terminal.ts"
import { HELD_FOR_AUTHOR, holding, NOTHING_WRITTEN, sentAway } from "./drafts.ts"
import { loadHeld } from "./branches.ts"
import type { Anchor } from "../domain/patch/index.ts"
import { rowShowing, selectionRange } from "./cursor.ts"
import { remarkHere, threadHere } from "./notes.ts"
import { panelEntry, type PanelEntry } from "./panel.ts"
import { selectedBranch, selectedPatch, type StagedComment, theirPull, type TuiState } from "./state.ts"
import { counted } from "./words.ts"
import { Comment, type CommentRequest, Draft } from "../review/index.ts"
import { staying, worktreeOf } from "./reading.ts"
import { loadSent } from "./reading.ts"

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

const openOther = (app: Terminal, entry: PanelEntry | undefined): Work => {
  if (entry === undefined) {
    return Effect.sync(() => app.commit(withNoticeHere(app.state, "nothing in the review yet")))
  }
  if (entry.kind === "fold") return Effect.sync(() => app.commit({ ...app.state, openMoved: !entry.open }))
  return entry.kind === "remark" ? openRemark(app, entry.remark) : Effect.void
}

export const openPanelEntry = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const entry = panelEntry(app.state)
    if (entry?.kind !== "comment") {
      yield* openOther(app, entry)
      return
    }
    yield* readRewrite(app, entry)
    const at = app.state.patches.findIndex((patch) => patch.path === entry.comment.file)
    if (at === -1 || entry.comment.outside === true) {
      yield* openAway(app, entry, at)
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

const openAway = (app: Terminal, entry: Extract<PanelEntry, { kind: "comment" }>, at: number): Work =>
  Effect.gen(function* () {
    if (at !== -1) {
      yield* openThreadInFull(app, entry)
      return
    }
    yield* readAnswers(app, entry.comment.id)
    app.commit(withNoticeHere(app.state, `${entry.comment.file} is not on this branch`))
  })

const openThreadInFull = (app: Terminal, entry: Extract<PanelEntry, { kind: "comment" }>): Work =>
  Effect.gen(function* () {
    yield* readAnswers(app, entry.comment.id)
    const said = withNoticeHere(app.state, "the diff no longer has that line")
    app.commit({ ...said, screen: "thread", returnTo: said.screen })
  })

export const jumpingPastGaps = (app: Terminal, opened: TuiState,
  at: number,
  entry: Extract<PanelEntry, { kind: "comment" }>,): Work => {
  return Effect.gen(function* () {
    const wide = { ...opened, revealed: allRevealed(opened) }
    const shown = selectedPatch(wide)
    if (shown === undefined || rowShowing(shown, entry.comment.end) === undefined) {
      yield* openThreadInFull(app, entry)
      return
    }
    app.commit(openedAt({ ...app.measured(), revealed: wide.revealed }, at, entry.comment.end))
    yield* turnedTo(app)
    yield* readAnswers(app, entry.comment.id)
  })
}

const readRewrite = (app: Terminal, entry: Extract<PanelEntry, { kind: "comment" }>): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    const id = entry.comment.id
    if (entry.section !== "held" || entry.comment.rewritten !== true) return
    if (id === undefined || branch === undefined) return
    const was = app.state.panelIndex
    yield* Draft.markSeen(yield* worktreeOf(app, branch.branch), id, new Date().toISOString())
    yield* loadHeld(app)
    app.commit({ ...app.state, panelIndex: was })
  })
}

export const readAnswers = (app: Terminal, id: string | undefined): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (id === undefined || branch === undefined) return
    yield* Comment.markRead(yield* worktreeOf(app, branch.branch), id)
    const held = app.state.panelIndex
    const sent = yield* loadSent(app, branch.branch)
    app.commit({ ...withSent(app.state, sent), panelIndex: held })
  })
}

export const send = (app: Terminal): Work => {
  if (app.state.answerTo !== undefined) return sendRemarkAnswer(app, app.state.answerTo)
  if (app.state.about !== undefined) return sendRedraftAsk(app, app.state.about)
  return app.state.replyTo === undefined ? sendComment(app) : sendReply(app, app.state.replyTo)
}

const toAgent = (
  app: Terminal,
  where: Pick<StagedComment, "file" | "side" | "start" | "end">,
  body: string,
  about?: string,
): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    yield* Comment.submit(yield* worktreeOf(app, branch.branch), {
      ...where,
      body,
      id: randomUUID(),
      at: new Date().toISOString(),
      theirs: true,
      ...(about === undefined ? {} : { draft: about }),
    })
    const sent = yield* loadSent(app, branch.branch)
    app.commit(withNotice(sentAway({ ...withSent(app.state, sent), about: undefined }), "sent to the agent"))
  })
}

const sendRedraftAsk = (app: Terminal, about: string): Work => {
  const held = app.state.held.find((one) => one.id === about)
  if (held === undefined) return Effect.sync(() => app.commit(withNotice(sentAway(app.state), "that note is gone")))
  if (app.state.draft.trim().length === 0) {
    return Effect.sync(() => app.commit(withNotice(app.state, NOTHING_WRITTEN)))
  }
  return toAgent(app, held, app.screen.written(), about)
}

const toAuthor = (app: Terminal, file: string, anchor: Anchor, body: string): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    yield* Draft.add(yield* worktreeOf(app, branch.branch), {
      file,
      side: anchor.side,
      start: anchor.start,
      end: anchor.end,
      body,
      id: randomUUID(),
      at: new Date().toISOString(),
      wroteBy: "reviewer",
    })
    yield* loadHeld(app)
    const many = app.state.held.length
    app.commit(
      withNotice(sentAway(app.state), `${HELD_FOR_AUTHOR} — ${counted(many, "note")} waiting, press C to send`),
    )
  })
}

export const sendReply = (app: Terminal, to: string): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    if (app.state.draft.trim().length === 0) {
      app.commit(withNotice(app.state, NOTHING_WRITTEN))
      return
    }
    yield* Comment.reply(yield* worktreeOf(app, branch.branch), {
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
    if (theirPull(app.state)) {
      const where = { file: patch.path, side: anchor.value.side, start: anchor.value.start, end: anchor.value.end }
      yield* app.state.reader === "author" ? toAuthor(app, patch.path, anchor.value, body) : toAgent(app, where, body)
      return
    }
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
    yield* Comment.submit(yield* worktreeOf(app, branch.branch), {
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
  return Effect.gen(function* () {
    const was = app.state.panelIndex
    const branch = selectedBranch(app.state)
    const draft = app.state.held[at]?.id
    if (theirPull(app.state) && branch !== undefined && draft !== undefined) {
      yield* Effect.ignore(Draft.drop(yield* worktreeOf(app, branch.branch), draft))
      yield* loadHeld(app)
      app.commit(withNotice(staying(app.state, was), "dropped, the author never saw it"))
      return
    }
    const held = app.state.held.filter((_, index) => index !== at)
    app.commit(withNotice(staying({ ...app.state, held }, was), "dropped, it was never sent"))
  })
}

const unreadSaid = (unread: number): string =>
  unread === 1
    ? "1 note rewritten by the agent is unread — open it in the review first"
    : `${unread} notes rewritten by the agent are unread — open them in the review first`

const keptSaid = (kept: number): string => `${counted(kept, "note")} kept`

const dispatchDrafts = (app: Terminal): Work => {
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    if (branch === undefined) return
    const unread = app.state.held.filter((one) => one.rewritten === true).length
    if (unread > 0) {
      app.commit(withNotice(app.state, unreadSaid(unread)))
      return
    }
    const worktree = yield* worktreeOf(app, branch.branch)
    const said = yield* Draft.dispatch(app.repo, worktree).pipe(
      Effect.map((sent) => `sent ${counted(sent.sent, "note")} to the pull request`),
      Effect.catchTags({
        PullMoved: () => Effect.succeed(`the pull request moved — read it again; ${keptSaid(app.state.held.length)}`),
        NothingDrafted: () => Effect.succeed("nothing held for the author"),
        PartlySent: (part) =>
          Effect.succeed(
            part.sent === 0
              ? `the forge confirmed none of the notes; ${keptSaid(part.held)}`
              : `sent ${part.sent} to the pull request, ${keptSaid(part.held)}`,
          ),
        ForgeUnavailable: () => Effect.succeed(`could not reach the forge; ${keptSaid(app.state.held.length)}`),
      }),
    )
    yield* loadHeld(app)
    app.commit(withNotice(app.state, said))
  })
}

export const sendHeld = (app: Terminal): Work => {
  if (theirPull(app.state)) return dispatchDrafts(app)
  return Effect.gen(function* () {
    const branch = selectedBranch(app.state)
    const [first, ...rest] = app.state.held
    if (branch === undefined || first === undefined) return
    const at = new Date().toISOString()
    const asked = (comment: StagedComment): CommentRequest => ({
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
    yield* Comment.submitMany(yield* worktreeOf(app, branch.branch), [asked(first), ...rest.map(asked)])
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
    yield* Comment.submit(yield* worktreeOf(app, branch.branch), {
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

export const askAgent = (app: Terminal): Work => {
  return Effect.sync(() => {
    const entry = app.state.focus === "review" ? panelEntry(app.state) : undefined
    if (entry?.kind === "comment" && entry.section === "held" && entry.comment.id !== undefined) {
      app.commit({
        ...app.state,
        screen: "compose",
        draft: "",
        draftAt: "",
        replyTo: undefined,
        reader: "agent",
        about: entry.comment.id,
      })
      return
    }
    const opened = reduce(app.measured(), "compose.open")
    app.commit(opened.screen === "compose" ? { ...opened, reader: "agent" } : opened)
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
