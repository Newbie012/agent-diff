import { randomUUID } from "node:crypto"
import { buildReport } from "./report.ts"
import { createCliRenderer, type CliRenderer, type KeyEvent } from "@opentui/core"
import { Effect, Option } from "effect"
import { anchorFor } from "../domain/patch/index.ts"
import {
  listBranches,
  listPatches,
  fileSource,
  listPending,
  listSent,
  listStorySteps,
  reviewProgress,
  saveReport,
  stageComment,
  submitReview,
  submitComment,
  toggleVouch,
} from "../cli/index.ts"
import type { Git } from "../service/git/index.ts"
import type { Store } from "../service/store/index.ts"
import { actionFor, takesText, type Action } from "./command.ts"
import {
  initialState,
  nextUnreviewed,
  rowAtSourceLine,
  sourceLineAt,
  stepContext,
  selectedBranch,
  selectedPatch,
  selectionRange,
  type TuiState,
} from "./model.ts"
import {
  atFile,
  backspaced,
  draggedTo,
  paletteChoice,
  paletteClosed,
  paletteMoved,
  reduce,
  scrolled,
  typed,
  withNotice,
  withContext,
  withBranches,
  withPatches,
  withPending,
  withSent,
  withSource,
  withStory,
  withVouched,
} from "./reduce.ts"
import { Screen } from "./render.ts"
import { readSession, sessionOf, writeSession, type Session } from "./session.ts"

type Needs = Git | Store

export const NOTICE_MS = 2200

export type AppOptions = {
  readonly renderer: CliRenderer
  readonly repo: string
  readonly run: <A>(effect: Effect.Effect<A, unknown, Needs>) => Promise<A>
  readonly branches: TuiState["branches"]
  readonly noticeMs?: number | undefined
  readonly sessionPath?: string | undefined
  readonly resume?: Session | undefined
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
  private readonly keys: Array<string> = []
  private fading: ReturnType<typeof setTimeout> | undefined

  constructor(options: AppOptions) {
    this.renderer = options.renderer
    this.repo = options.repo
    this.run = options.run
    this.noticeMs = options.noticeMs ?? NOTICE_MS
    this.sessionPath = options.sessionPath
    const { branches, renderer } = options
    this.state = initialState(branches)
    this.screen = new Screen(renderer, options.repo)
    this.screen.update(this.state)
    this.screen.listen({
      onScroll: (delta) => this.commit(scrolled(this.measured(), delta)),
      onDrag: (from, to) => this.commit(draggedTo(this.measured(), from, to)),
      onChip: (key) => this.dispatchTask(() => this.onKey(asKey(key))),
    })
    renderer.keyInput.on("keypress", (key) => this.dispatch(key))
    renderer.on("destroy", () => this.stopFading())
    renderer.on("frame", () => this.syncGeometry())
    const resume = options.resume
    if (resume !== undefined) this.dispatchTask(() => this.resume(resume))
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
      "pending.open": () => this.openPending(),
      "pending.submit": () => this.sendReview(),
      "report.open": () => this.commit(reduce(this.measured(), "report.open")),
      back: () => this.goBack(),
      "report.send": () => this.sendReport(),
      "context.more": () => this.expand(1),
      "context.less": () => this.expand(-1),
    }
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

  private async openBranch(): Promise<void> {
    const branch = selectedBranch(this.state)
    if (branch === undefined) return
    const patches = await this.run(listPatches(this.repo, branch.branch))
    const progress = await this.run(reviewProgress(this.repo, branch.branch))
    const pending = await this.run(listPending(this.repo, branch.branch))
    const steps = await this.run(listStorySteps(this.repo, branch.branch))
    const opened = withVouched(withPatches(this.state, patches), progress.vouched)
    const sent = await this.loadSent(branch.branch)
    this.commit(withStory(withSent(withPending(opened, pending, "review"), sent), steps))
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
    const request = this.request()
    if (request === undefined) return this.commit(withNotice(this.state, "nothing to stage"))
    await this.run(stageComment(request))
    const branch = selectedBranch(this.state)
    const pending =
      branch === undefined ? [] : await this.run(listPending(this.repo, branch.branch))
    const next = withPending(this.state, pending, "review")
    this.commit(withNotice(next, `${pending.length} staged`))
  }

  private loadSent(branch: string): Promise<TuiState["sent"]> {
    return this.run(listSent(this.repo, branch))
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
    const next = stepContext(this.state.context, delta)
    if (branch === undefined || next === this.state.context) return
    const line = sourceLineAt(this.state, this.state.cursor)
    const patches = await this.run(listPatches(this.repo, branch.branch, next))
    const patch = patches[this.state.patchIndex]
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
  return new App({
    renderer,
    repo,
    run: Effect.runPromiseWith(context),
    branches,
    noticeMs,
    sessionPath,
    resume,
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
