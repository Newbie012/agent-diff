import { randomUUID } from "node:crypto"
import { createCliRenderer, type CliRenderer, type KeyEvent } from "@opentui/core"
import { Effect, Option } from "effect"
import { buildReport } from "./report.ts"
import { anchorFor } from "../domain/patch/index.ts"
import {
  listBranches,
  listPatches,
  fileSource,
  listPending,
  listSent,
  listLayers,
  reviewProgress,
  saveReport,
  saveWrap,
  stageComment,
  editStaged,
  dropStaged,
  submitReview,
  submitComment,
  toggleVouch,
  settleThread,
} from "../cli/index.ts"
import type { Git } from "../service/git/index.ts"
import { Store } from "../service/store/index.ts"
import { watchAnswers, type Watching } from "./watch.ts"
import { Forge } from "../service/forge/index.ts"
import { actionFor, takesText, type Action } from "./command.ts"
import { gapAtRow, GAP_CHUNK } from "./gaps.ts"
import {
  initialState,
  nextUnreviewed,
  rowAtSourceLine,
  sourceLineAt,
  layerContext,
  selectedBranch,
  selectedPatch,
  selectionRange,
  spokenSince,
  threadAtRow,
  threadAtStop,
  WHOLE_FILE,
  type TuiState,
} from "./model.ts"
import {
  atFile,
  backspaced,
  draggedTo,
  gapOpened,
  paletteChoice,
  paletteClosed,
  paletteMoved,
  reduce,
  scrolled,
  panBy,
  typed,
  withNotice,
  withNoticeHere,
  withWaiting,
  withContext,
  withBranches,
  withPulls,
  withFull,
  withPatches,
  restoredTo,
  withPending,
  withSent,
  withSource,
  withLayers,
  withVouched,
} from "./reduce.ts"
import { Screen } from "./render.ts"
import { readSession, sessionOf, writeSession, type Session } from "./session.ts"

type Needs = Git | Store | Forge

export const NOTICE_MS = 2200

export type AppOptions = {
  readonly renderer: CliRenderer
  readonly repo: string
  readonly run: <A>(effect: Effect.Effect<A, unknown, Needs>) => Promise<A>
  readonly branches: TuiState["branches"]
  readonly noticeMs?: number | undefined
  readonly sessionPath?: string | undefined
  readonly resume?: Session | undefined
  readonly wrap?: boolean | undefined
  readonly storeRoot?: string | undefined
}

const PRINTABLE = /^[\S ]$/
const KEY_HISTORY = 40

const copyToClipboard = (text: string): void => {
  const encoded = Buffer.from(text, "utf8").toString("base64")
  process.stdout.write(`\u001B]52;c;${encoded}\u0007`)
}

const asKey = (name: string): KeyEvent =>
  (name.startsWith("ctrl+")
    ? { name: name.slice(5), sequence: name.slice(5), ctrl: true, shift: false }
    : { name, sequence: name, ctrl: false, shift: false }) as KeyEvent

const keyName = (key: KeyEvent): string => {
  const base = key.shift && key.name.length === 1 ? key.name.toUpperCase() : key.name
  return key.ctrl ? `ctrl+${base}` : base
}

export class App {
  private state: TuiState
  private readonly screen: Screen
  private pending: Promise<void> = Promise.resolve()
  private failure = ""

  private readonly renderer: CliRenderer
  private readonly repo: string
  private readonly run: <A>(effect: Effect.Effect<A, unknown, Needs>) => Promise<A>
  private readonly noticeMs: number
  private readonly sessionPath: string | undefined
  private remembered = ""
  private wrapKept = false
  private readonly keys: Array<string> = []
  private fading: ReturnType<typeof setTimeout> | undefined
  private wheel = 0
  private sideways = 0
  private watching: Watching | undefined

  constructor(options: AppOptions) {
    this.renderer = options.renderer
    this.repo = options.repo
    this.run = options.run
    this.noticeMs = options.noticeMs ?? NOTICE_MS
    this.sessionPath = options.sessionPath
    this.wrapKept = options.wrap === true
    const { branches, renderer } = options
    this.state = { ...initialState(branches), wrap: options.wrap === true }
    this.screen = new Screen(renderer, options.repo)
    this.screen.update(this.state)
    this.screen.listen({
      onScroll: (delta) => this.onWheel(delta),
      onPan: (delta) => this.onPanWheel(delta),
      onDrag: (from, to) => this.commit(draggedTo(this.measured(), from, to)),
      onChip: (key) => this.dispatchTask(() => this.onKey(asKey(key))),
    })
    renderer.keyInput.on("keypress", (key) => this.dispatch(key))
    renderer.on("destroy", () => this.stopWatching())
    renderer.on("destroy", () => this.stopFading())
    renderer.on("frame", () => this.syncGeometry())
    renderer.setFrameCallback(async () => this.applyWheel())
    const resume = options.resume
    this.startWatching(options.storeRoot)
    this.dispatchTask(() => this.loadPulls())
    if (resume !== undefined) this.dispatchTask(() => this.resume(resume))
  }

  private startWatching(root: string | undefined): void {
    if (root === undefined) return
    this.watching = watchAnswers(root, () => this.dispatchTask(() => this.noticeAnswers()))
  }

  private stopWatching(): void {
    this.watching?.stop()
    this.watching = undefined
  }

  private async noticeAnswers(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return this.noticeOnList()
    const sent = await this.loadSent(branch.branch)
    const said = spokenSince(this.state.sent, sent)
    if (said === 0) return
    this.commit(withWaiting(this.state, `${said} answered · press r`))
  }

  private async noticeOnList(): Promise<void> {
    this.commit(withWaiting(this.state, "the agent answered · press r"))
  }

  private dispatchTask(task: () => Promise<void>): void {
    this.pending = this.pending.then(task).catch((cause: unknown) => this.fail(cause))
  }

  private async resume(session: Session): Promise<void> {
    const branches = this.state.branches
    if (session.branchIndex >= branches.length) return
    this.state = { ...this.state, branchIndex: session.branchIndex }
    await this.openBranch()
    const patchIndex = Math.min(session.patchIndex, Math.max(0, this.state.patches.length - 1))
    this.commit({ ...this.state, patchIndex, cursor: session.cursor, top: session.top })
    await this.loadSource()
  }

  private rememberWrap(next: TuiState): void {
    if (next.wrap === this.wrapKept) return
    this.wrapKept = next.wrap
    void this.run(saveWrap(next.wrap)).catch(() => undefined)
  }

  private rememberPlace(next: TuiState): void {
    if (this.sessionPath === undefined || next.screen !== "review") return
    const session = sessionOf(next)
    const line = JSON.stringify(session)
    if (line === this.remembered) return
    this.remembered = line
    void writeSession(this.sessionPath, session)
  }

  private dispatch(key: KeyEvent): void {
    this.pending = this.pending
      .then(() => this.onKey(key))
      .catch((cause: unknown) => this.fail(cause))
  }

  private fail(cause: unknown): void {
    this.failure = cause instanceof Error ? `${cause.message}\n${cause.stack ?? ""}` : String(cause)
  }

  lastFailure(): string {
    return this.failure
  }

  settled(): Promise<void> {
    return this.pending
  }

  private onWheel(delta: number): void {
    this.wheel += delta
    this.renderer.requestRender()
  }

  private onPanWheel(delta: number): void {
    this.sideways += delta
    this.renderer.requestRender()
  }

  private applyWheel(): void {
    const down = this.wheel
    const across = this.sideways
    if (down === 0 && across === 0) return
    this.wheel = 0
    this.sideways = 0
    const moved = down === 0 ? this.measured() : scrolled(this.measured(), down)
    this.commit(across === 0 ? moved : panBy(moved, across))
  }

  private syncGeometry(): void {
    const rows = this.screen.viewportRows()
    if (rows === this.state.viewport) return
    this.commit({ ...this.state, viewport: rows })
  }

  private measured(): TuiState {
    return { ...this.state, viewport: this.screen.viewportRows() }
  }

  private commit(next: TuiState): void {
    const appeared = next.notice.length > 0 && next.notice !== this.state.notice
    this.state = next
    this.rememberPlace(next)
    this.rememberWrap(next)
    this.screen.update(next)
    if (appeared) this.fade()
  }

  private stopFading(): void {
    if (this.fading === undefined) return
    clearTimeout(this.fading)
    this.fading = undefined
  }

  private fade(): void {
    this.stopFading()
    this.fading = setTimeout(() => {
      this.fading = undefined
      if (this.state.notice.length > 0) this.commit({ ...this.state, notice: "" })
    }, this.noticeMs)
  }

  private effects(): Readonly<Partial<Record<Action, () => Promise<void> | void>>> {
    return {
      quit: () => this.renderer.destroy(),
      "branch.open": () => this.openBranch(),
      "compose.submit": () => this.send(),
      "compose.stage": () => this.stage(),
      "palette.run": () => this.runChoice(),
      "comment.next": () => this.walkComments(1),
      "comment.prev": () => this.walkComments(-1),
      "file.next": () => this.moveFile(1),
      "file.prev": () => this.moveFile(-1),
      "cursor.next": () => this.commitSynced("cursor.next"),
      "cursor.prev": () => this.commitSynced("cursor.prev"),
      "rail.toggle": () => this.commitSynced("rail.toggle"),
      "file.vouch": () => this.vouch(false),
      "file.vouch.next": () => this.vouch(true),
      "thread.settle": () => this.settleHere(),
      "review.reload": () =>
        this.state.screen === "branches" ? this.reloadList() : this.reloadBranch(),
      "pending.open": () => this.openPending(),
      "pending.edit": () => this.editStagedComment(),
      "pending.drop": () => this.dropStagedComment(),
      "pending.submit": () => this.sendReview(),
      "report.open": () => this.commit(reduce(this.measured(), "report.open")),
      back: () => this.goBack(),
      "report.send": () => this.sendReport(),
      "context.more": () => this.expand(1),
      "context.less": () => this.expand(-1),
      "tree.expand": () => this.unfold(1),
      "tree.collapse": () => this.unfold(-1),
    }
  }

  private async unfold(delta: number): Promise<void> {
    const gap =
      this.state.focus === "diff" ? gapAtRow(this.state, this.state.cursor) : undefined
    const action: Action = delta > 0 ? "tree.expand" : "tree.collapse"
    if (gap === undefined) return this.commit(reduce(this.measured(), action))
    if (delta > 0) await this.loadFull()
    this.commit(gapOpened(this.measured(), gap.index, delta * GAP_CHUNK))
  }

  private async loadFull(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined || this.state.full.length > 0) return
    const full = await this.run(listPatches(this.repo, branch.branch, WHOLE_FILE))
    this.commit(withFull(this.state, full))
  }

  private async onKey(key: KeyEvent, forced?: Action): Promise<void> {
    const action = forced ?? actionFor(this.state.screen, keyName(key))
    this.remember(action, key)
    if (action === undefined) return this.onText(key)
    const effect = this.effects()[action]
    if (effect !== undefined) return effect()
    this.commit(reduce(this.measured(), action))
  }

  private onText(key: KeyEvent): void {
    if (!takesText(this.state.screen)) return
    if (key.name === "backspace") return this.commit(backspaced(this.state))
    if (key.name === "down") return this.commit(paletteMoved(this.state, 1))
    if (key.name === "up") return this.commit(paletteMoved(this.state, -1))
    if (PRINTABLE.test(key.sequence)) this.commit(typed(this.state, key.sequence))
  }

  private async runChoice(): Promise<void> {
    const chosen = paletteChoice(this.state)
    const closed = paletteClosed(this.state)
    if (chosen === undefined) return this.commit(closed)
    this.state = closed
    await this.onKey({ name: "", ctrl: false, sequence: "" } as KeyEvent, chosen)
  }

  private async readBranch(name: string): Promise<TuiState> {
    const patches = await this.run(listPatches(this.repo, name))
    const progress = await this.run(reviewProgress(this.repo, name))
    const pending = await this.run(listPending(this.repo, name))
    const layers = await this.run(listLayers(this.repo, name))
    const sent = await this.loadSent(name)
    const opened = withVouched(withPatches(this.state, patches), progress.vouched)
    return withLayers(withSent(withPending(opened, pending, "review"), sent), layers)
  }

  private async openBranch(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return
    this.commit(await this.readBranch(branch.branch))
    await this.loadSource()
  }

  private async settleHere(): Promise<void> {
    const branch = selectedBranch(this.state)
    const thread = threadAtStop(this.state) ?? threadAtRow(this.state, this.state.cursor)
    const id = thread?.id
    if (branch === undefined || id === undefined) {
      return this.commit(withNotice(this.state, "no thread here"))
    }
    await this.run(settleThread(this.repo, branch.branch, id, new Date().toISOString()))
    const sent = await this.loadSent(branch.branch)
    const held = withSent({ ...this.state, opened: this.state.opened.filter((was) => was !== id) }, sent)
    this.commit(withNotice(held, "settled"))
  }

  private async reloadList(): Promise<void> {
    const here = selectedBranch(this.state)?.branch
    const branches = await this.run(listBranches(this.repo))
    const read = withBranches(this.state, branches)
    const at = branches.findIndex((candidate) => candidate.branch === here)
    const kept = at === -1 ? read : { ...read, branchIndex: at }
    this.commit(withWaiting(withNoticeHere(kept, "read the list again"), ""))
    this.dispatchTask(() => this.loadPulls())
  }

  private async reloadBranch(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return
    const path = selectedPatch(this.state)?.path
    const line = sourceLineAt(this.state, this.state.cursor)
    const read = await this.readBranch(branch.branch)
    this.commit(withWaiting(withNotice(restoredTo(read, path, line), "read the branch again"), ""))
    await this.loadSource()
  }

  private async goBack(): Promise<void> {
    const next = reduce(this.measured(), "back")
    this.commit(next)
    if (next.screen !== "branches") return
    this.commit(withBranches(this.state, await this.run(listBranches(this.repo))))
  }

  private async walkComments(delta: number): Promise<void> {
    const was = this.state.patchIndex
    this.commit(reduce(this.measured(), delta > 0 ? "comment.next" : "comment.prev"))
    if (this.state.patchIndex !== was) await this.loadSource()
  }

  private async commitSynced(action: Action): Promise<void> {
    const was = this.state.patchIndex
    this.commit(reduce(this.measured(), action))
    if (this.state.patchIndex !== was) await this.loadSource()
  }

  private moveFile(delta: number): Promise<void> {
    return this.commitSynced(delta > 0 ? "file.next" : "file.prev")
  }

  private async vouch(advance: boolean): Promise<void> {
    const branch = selectedBranch(this.state)
    const patch = selectedPatch(this.state)
    if (branch === undefined || patch === undefined) return
    const report = await this.run(
      toggleVouch({ repo: this.repo, branch: branch.branch, file: patch.path }),
    )
    const marked = report.vouched.includes(patch.path)
    const next = withVouched(this.state, report.vouched)
    if (!advance) {
      return this.commit(withNotice(next, marked ? `marked ${patch.path}` : `unmarked ${patch.path}`))
    }
    const target = nextUnreviewed(next, next.patchIndex)
    if (target === undefined) return this.commit(withNotice(next, "every file reviewed"))
    this.commit(withNotice(atFile(next, target), `marked ${patch.path}`))
  }

  private request(): Parameters<typeof submitComment>[0] | undefined {
    const patch = selectedPatch(this.state)
    const branch = selectedBranch(this.state)
    const [from, to] = selectionRange(this.state)
    if (patch === undefined || branch === undefined || this.state.draft.length === 0) return undefined
    const anchor = anchorFor(patch, from, to)
    if (Option.isNone(anchor)) return undefined
    return {
      repo: this.repo,
      branch: branch.branch,
      file: patch.path,
      side: anchor.value.side,
      start: anchor.value.start,
      end: anchor.value.end,
      body: this.state.draft,
      id: randomUUID(),
      at: new Date().toISOString(),
    }
  }

  private async stage(): Promise<void> {
    const editing = this.state.editing
    if (editing !== undefined) return this.restage(editing)
    const request = this.request()
    if (request === undefined) return this.commit(withNotice(this.state, "nothing to stage"))
    await this.run(stageComment(request))
    const branch = selectedBranch(this.state)
    const pending =
      branch === undefined ? [] : await this.run(listPending(this.repo, branch.branch))
    const next = withPending(this.state, pending, "review")
    this.commit(withNotice(next, `${pending.length} staged`))
  }

  private async restage(id: string): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return
    await this.run(
      editStaged({ repo: this.repo, branch: branch.branch, id, body: this.state.draft }),
    )
    const pending = await this.run(listPending(this.repo, branch.branch))
    const next = withPending({ ...this.state, editing: undefined, draft: "" }, pending, "pending")
    this.commit(withNoticeHere(next, "reworded"))
  }

  private loadSent(branch: string): Promise<TuiState["sent"]> {
    return this.run(listSent(this.repo, branch))
  }

  private async loadPulls(): Promise<void> {
    const forge = await this.run(Effect.map(Forge, (service) => service))
    const asked = forge.pulls(this.repo)
    const pulls = await this.run(
      asked.pipe(Effect.catchTag("ForgeUnavailable", () => Effect.succeed([]))),
    )
    if (pulls.length === 0) return
    const found = Object.fromEntries(pulls.map((pull) => [pull.branch, pull.state]))
    this.commit(withPulls(this.state, found))
  }

  private async loadSource(): Promise<void> {
    const branch = selectedBranch(this.state)
    const patch = selectedPatch(this.state)
    if (branch === undefined || patch === undefined) return
    const source = await this.run(fileSource(this.repo, branch.branch, patch.path))
    this.commit(withSource(this.state, source))
  }

  private async expand(delta: number): Promise<void> {
    const branch = selectedBranch(this.state)
    const next = layerContext(this.state.context, delta)
    if (branch === undefined || next === this.state.context) return
    const line = sourceLineAt(this.state, this.state.cursor)
    const patches = await this.run(listPatches(this.repo, branch.branch, next))
    const widened = withContext(this.state, next, patches, 0)
    const patch = selectedPatch(widened)
    const cursor = patch === undefined || line === undefined ? 0 : rowAtSourceLine(patch, line)
    this.commit(withContext(this.state, next, patches, cursor))
  }

  private async openPending(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return
    const pending = await this.run(listPending(this.repo, branch.branch))
    if (pending.length === 0) return this.commit(withNotice(this.state, "nothing staged"))
    this.commit(withPending(this.state, pending, "pending"))
  }

  private editStagedComment(): void {
    const entry = this.state.pending[this.state.pendingIndex]
    if (entry?.id === undefined) return
    this.commit({
      ...this.state,
      screen: "compose",
      draft: entry.body,
      editing: entry.id,
    })
  }

  private async dropStagedComment(): Promise<void> {
    const branch = selectedBranch(this.state)
    const entry = this.state.pending[this.state.pendingIndex]
    if (branch === undefined || entry?.id === undefined) return
    await this.run(dropStaged(this.repo, branch.branch, entry.id))
    const pending = await this.run(listPending(this.repo, branch.branch))
    const kept = withPending(this.state, pending, pending.length === 0 ? "review" : "pending")
    const at = Math.min(this.state.pendingIndex, Math.max(0, pending.length - 1))
    const said = pending.length === 0 ? "nothing staged" : `withdrawn — ${pending.length} left`
    this.commit(withNoticeHere({ ...kept, pendingIndex: at }, said))
  }

  private async sendReview(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return
    const report = await this.run(
      submitReview(this.repo, branch.branch, randomUUID(), new Date().toISOString()),
    )
    const cleared = withSent(
      withPending(this.state, [], "review"),
      await this.loadSent(branch.branch),
    )
    this.commit(withNotice(cleared, `review sent — ${report.submitted} comment${report.submitted === 1 ? "" : "s"}, one wake-up`))
  }

  private remember(action: Action | undefined, key: KeyEvent): void {
    if (takesText(this.state.screen) && action === undefined) return
    this.keys.push(action ?? keyName(key))
    if (this.keys.length > KEY_HISTORY) this.keys.shift()
  }

  private async sendReport(): Promise<void> {
    if (this.state.draft.trim().length === 0) {
      return this.commit(withNotice(this.state, "say what went wrong first"))
    }
    const text = buildReport(this.state, {
      repo: this.repo,
      keys: this.keys,
      failure: this.failure,
      width: this.renderer.width,
      height: this.renderer.height,
    })
    const stamp = new Date().toISOString().replace(/[:.]/g, "-")
    const path = await this.run(saveReport(stamp, text))
    copyToClipboard(text)
    const closed = { ...this.state, screen: this.state.returnTo, draft: "" }
    this.commit(withNotice(closed, `report copied — ${path}`))
  }

  private async send(): Promise<void> {
    const patch = selectedPatch(this.state)
    const branch = selectedBranch(this.state)
    const [from, to] = selectionRange(this.state)
    if (patch === undefined || branch === undefined || this.state.draft.length === 0) return
    const anchor = anchorFor(patch, from, to)
    if (Option.isNone(anchor)) return this.commit(withNotice(this.state, "nothing selected"))
    await this.run(
      submitComment({
        repo: this.repo,
        branch: branch.branch,
        file: patch.path,
        side: anchor.value.side,
        start: anchor.value.start,
        end: anchor.value.end,
        body: this.state.draft,
        id: randomUUID(),
        at: new Date().toISOString(),
      }),
    )
    const sent = await this.loadSent(branch.branch)
    this.commit(withNotice(withSent(this.state, sent), "sent to the agent"))
  }
}

export const launch = Effect.fn("Tui.launch")(function* (
  repo: string,
  renderer: CliRenderer,
  noticeMs?: number,
  sessionPath?: string,
) {
  const context = yield* Effect.context<Needs>()
  const branches = yield* listBranches(repo)
  const resume =
    sessionPath === undefined ? undefined : yield* Effect.promise(() => readSession(sessionPath))
  const store = yield* Store
  const settings = yield* store.settings
  return new App({
    renderer,
    repo,
    run: Effect.runPromiseWith(context),
    branches,
    noticeMs,
    sessionPath,
    resume,
    wrap: settings.wrap === true,
    storeRoot: store.root,
  })
})

const untilDestroyed = (renderer: CliRenderer): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    renderer.on("destroy", () => resume(Effect.void))
  })

export const runOn = Effect.fn("Tui.runOn")(function* (
  repo: string,
  renderer: CliRenderer,
  sessionPath?: string,
) {
  yield* launch(repo, renderer, undefined, sessionPath)
  yield* untilDestroyed(renderer)
})

export const runTui = Effect.fn("Tui.run")(function* (repo: string, sessionPath?: string) {
  const renderer = yield* Effect.promise(() => createCliRenderer({ exitOnCtrlC: true }))
  yield* runOn(repo, renderer, sessionPath)
})

export type { Action }
