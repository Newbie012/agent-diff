import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync } from "node:fs"
import { realpath } from "node:fs/promises"
import { platform } from "node:os"
import { join, resolve } from "node:path"
import {
  createCliRenderer,
  getTreeSitterClient,
  stripAnsiSequences,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core"
import { Cause, Deferred, Effect, Fiber, Option, Queue, Result, Stream, SubscriptionRef } from "effect"
import { buildReport } from "./report.ts"
import { anchorFor } from "../domain/patch/index.ts"
import { editorsAround, openingOf, templateFor } from "../domain/editor/index.ts"
import {
  listBranches,
  listRefs,
  summaryFor,
  markRead,
  type BranchSummary,
  listPatches,
  patchIn,
  fileSource,
  fileBefore,
  listSent,
  aroundIn,
  searchBranch,
  searchIn,
  layersIn,
  progressIn,
  readingOf,
  sentIn,
  setBase,
  clearBase,
  saveReport,
  commentIn,
  commentsIn,
  savePreference,
  submitComment,
  submitComments,
  submitReply,
  toggleVouch,
  vouchIn,
  vouchPartIn,
  type BranchReading,
  type CommentRequest,
  type Written,
  type VouchReport,
  removeComment,
  restoreComment,
  restoreIn,
  settleIn,
  removeIn,
  settleThread,
  settleRead,
  acceptIn,
  answerRemark,
  quoted,
  dismissIn,
  undismissIn,
  remarksIn,
  remarksHeldIn,
  remarksAgainst,
  type Remark,
} from "../cli/index.ts"
import { heldValues } from "../domain/preferences/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { Store } from "../service/store/index.ts"
import { answers } from "./watch.ts"
import { Forge } from "../service/forge/index.ts"
import { actionFor, takesText, type Action } from "./command.ts"
import { gapAtRow, shownOf, GAP_CHUNK } from "./gaps.ts"
import {
  initialState,
  isReviewed,
  layersHolding,
  partHere,
  readIn,
  nextUnreviewed,
  onLayers,
  rowAtSourceLine,
  rowShowing,
  sourceLineAt,
  layerContext,
  knownToHaveNoPull,
  pullHere,
  contextToggled,
  selectedBranch,
  selectedPatch,
  pickedText,
  selectedLines,
  type Spot,
  matchHere,
  refHere,
  selectionRange,
  spokenSince,
  panelEntry,
  remarkHere,
  remarkToTakeOn,
  remarkUnderCursor,
  type PanelEntry,
  panelEntries,
  threadAtStop,
  threadHere,
  WHOLE_FILE,
  type StagedComment,
  type TuiState,
} from "./model.ts"
import {
  atFile,
  openedAt,
  draggedTo,
  restingOn,
  pickedIn,
  gapOpened,
  gapShown,
  paletteChoice,
  paletteClosed,
  paletteMoved,
  reduce,
  restoredTo,
  resumedAt,
  railScrolled,
  scrolled,
  panBy,
  legible,
  withNotice,
  withNoticeHere,
  withWaiting,
  withArrived,
  withColumns,
  withDraft,
  withContext,
  withBranches,
  withPulls,
  withSilentForge,
  withFull,
  withPatches,
  withFinder,
  withAround,
  withChoices,
  withMatches,
  withRefs,
  allRevealed,
  withRemarks,
  withSent,
  withSource,
  withLayers,
  withVouched,
} from "./reduce.ts"
import { Display, displayOn, type Shape as DisplayShape } from "./display.ts"
import type { Needs, Work } from "./needs.ts"
import { Intent } from "./intent.ts"
import { readSession, sessionOf, writeSession, type Session } from "./session.ts"
import { upgradeHint } from "./upgrade.ts"

const LEAVING_MS = 3000
const LOOK_MS = 260
const LEAST_TERM = 2
const AGE_TICK_MS = 30_000

const LEAVING_SAID = "press ctrl+c again to leave"
const NOTHING_WRITTEN = "nothing written yet"
const WORTH_TIMING_MS = 250
const TIMES_KEPT = 40
const SLOWEST_KEPT = 3
const NOTHING_COUNTED = { file: 0, branch: 0, worktree: 0 }
const READING_PULL = "reading the pull request"
const FORGE_QUIET = "the forge did not answer, so no remarks are shown"

const countOf = (many: number, one: string): string => `${many} ${one}${many === 1 ? "" : "s"}`

const leavingSaid = (state: TuiState): string =>
  state.held.length === 0
    ? LEAVING_SAID
    : `${countOf(state.held.length, "comment")} never sent — press ctrl+c again to leave without them`

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

const alongFrom = (state: TuiState): TuiState => {
  const along = nextUnreviewed(state, state.patchIndex)
  return along === undefined ? withNotice(state, "every file reviewed") : atFile(state, along)
}
const NOTICE_MS = 2200

export type AppOptions = {
  readonly renderer: CliRenderer
  readonly repo: string
  readonly base?: string | undefined
  readonly display: DisplayShape
  readonly state: SubscriptionRef.SubscriptionRef<TuiState>
  readonly intents: Queue.Queue<Intent>
  readonly painting: Fiber.Fiber<void>
  readonly noticeMs?: number | undefined
  readonly sessionPath?: string | undefined
  readonly resume?: Session | undefined
  readonly opensOn?: number | undefined
  readonly partial?: boolean | undefined
  readonly chosen?: Partial<TuiState> | undefined
}

const KEY_HISTORY = 40
const DRAIN_PASSES = 8

const TRAIL_HISTORY = 20

const clockOf = (elapsed: number): string => {
  const seconds = Math.floor(elapsed / 1000)
  const shown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
  return shown.padStart(6)
}

const momentOf = (named: string, state: TuiState, elapsed: number): string => {
  const file = selectedPatch(state)?.path ?? "none"
  const place = `${state.screen}/${state.focus}`
  return `${clockOf(elapsed)}  ${named.padEnd(16)} ${place.padEnd(16)} row ${String(state.cursor + 1).padStart(5)}  ${file}`
}

const noticeOf = (notice: string, elapsed: number): string =>
  `${clockOf(elapsed)}  ${"said".padEnd(16)} ${notice}`

const COPIERS: Readonly<Record<string, ReadonlyArray<string>>> = {
  darwin: ["pbcopy"],
  linux: ["xclip", "-selection", "clipboard"],
  win32: ["clip"],
}

const wayland = (): ReadonlyArray<string> | undefined =>
  process.env["WAYLAND_DISPLAY"] === undefined ? undefined : ["wl-copy"]

const seedFor = (picked: string | undefined): string => picked?.trim() ?? ""

const handOver = (text: string): void => {
  if (!process.stdout.isTTY) return
  const named = wayland() ?? COPIERS[platform()]
  if (named === undefined) return
  const [command, ...rest] = named
  if (command === undefined) return
  const pipe = spawn(command, [...rest], { stdio: ["pipe", "ignore", "ignore"] })
  pipe.on("error", () => undefined)
  pipe.stdin.on("error", () => undefined)
  pipe.stdin.end(text)
}

const throughMultiplexer = (sequence: string): string => {
  if (process.env["TMUX"] !== undefined) return `\u001BPtmux;\u001B${sequence}\u001B\\`
  return process.env["STY"] === undefined ? sequence : `\u001BP${sequence}\u001B\\`
}

const ranAside = (command: string, args: ReadonlyArray<string>, from: string): boolean => {
  try {
    const child = spawn(command, [...args], { detached: true, stdio: "ignore", cwd: from })
    child.on("error", () => undefined)
    child.unref()
    return true
  } catch {
    return false
  }
}

const onThePath = (name: string): boolean =>
  (process.env["PATH"] ?? "")
    .split(":")
    .some((where) => where.length > 0 && existsSync(join(where, name)))

const saveEditor = Effect.fn("Tui.saveEditor")(function* (command: string) {
  const store = yield* Store
  const current = yield* store.settings
  const held = { ...current }
  if (command.length === 0) delete (held as Record<string, unknown>)["editor"]
  yield* store.saveSettings(command.length === 0 ? held : { ...held, editor: command })
})

const editorTold = Effect.gen(function* () {
  const store = yield* Store
  const kept = yield* store.settings
  const held = kept["editor"]
  return {
    editor: typeof held === "string" ? held : undefined,
    visual: process.env["VISUAL"],
    fallback: process.env["EDITOR"],
    termProgram: process.env["TERM_PROGRAM"],
    terminalEmulator: process.env["TERMINAL_EMULATOR"],
  }
})

const copyToClipboard = (text: string): void => {
  const encoded = Buffer.from(text, "utf8").toString("base64")
  process.stdout.write(throughMultiplexer(`\u001B]52;c;${encoded}\u0007`))
  handOver(text)
}
const lineUnder = (state: TuiState): ReadonlyArray<string> => {
  const row = selectedPatch(state)?.rows[state.cursor]
  return row === undefined ? [] : [row.text]
}

const asKey = (name: string): KeyEvent =>
  (name.startsWith("ctrl+")
    ? { name: name.slice(5), sequence: name.slice(5), ctrl: true, shift: false }
    : { name, sequence: name, ctrl: false, shift: false }) as KeyEvent

const openedPull = (state: string, opened: boolean): string => {
  if (!opened) return "could not reach the pull request"
  return state.length === 0 ? "opened the pull request" : `opened the ${state} pull request`
}

const LISTENS: ReadonlySet<string> = new Set(["keys", "palette", "search", "base", "editor"])

const WRITES: ReadonlySet<string> = new Set(["compose", "report"])

const OVER: ReadonlySet<string> = new Set([
  "compose",
  "report",
  "keys",
  "palette",
  "search",
  "settings",
  "base",
  "editor",
])

export const overReview = (screen: TuiState["screen"]): boolean => OVER.has(screen)

const writesInto = (screen: TuiState["screen"]): boolean => WRITES.has(screen)

const listens = (screen: TuiState["screen"]): boolean => LISTENS.has(screen)

const LETTER = /^[a-z]$/i

const laidOut = (key: KeyEvent): string => {
  if (key.baseCode === undefined || key.name.length !== 1) return key.name
  const laid = String.fromCodePoint(key.baseCode)
  return LETTER.test(laid) ? laid : key.name
}

const ARROWS: ReadonlySet<string> = new Set(["up", "down", "left", "right"])

const SHIFTED: Readonly<Record<string, string>> = {
  "1": "!",
  "2": "@",
  "3": "#",
  "4": "$",
  "5": "%",
  "6": "^",
  "7": "&",
  "8": "*",
  "9": "(",
  "0": ")",
  "-": "_",
  "=": "+",
  "[": "{",
  "]": "}",
  "\\": "|",
  ";": ":",
  "'": '"',
  ",": "<",
  ".": ">",
  "/": "?",
  "`": "~",
}

const keyName = (key: KeyEvent): string => {
  if (key.shift && (key.name === "tab" || ARROWS.has(key.name))) return `shift+${key.name}`
  const named = laidOut(key)
  const base = key.shift && named.length === 1 ? (SHIFTED[named] ?? named.toUpperCase()) : named
  return key.ctrl ? `ctrl+${base}` : base
}

export class App {
  private readonly held: SubscriptionRef.SubscriptionRef<TuiState>
  private readonly display: DisplayShape
  private readonly painting: Fiber.Fiber<void>
  private readonly intents: Queue.Queue<Intent>
  private consuming: Fiber.Fiber<void> | undefined
  private failure = ""
  private failureKind = ""
  private reading: BranchReading | undefined

  private readonly renderer: CliRenderer
  private readonly repo: string
  private readonly base: string | undefined
  private readonly noticeMs: number
  private roomed = 0
  private readonly sessionPath: string | undefined
  private remembered = ""
  private readonly chosen: Record<string, boolean> = {}
  private selectingNow = false
  private leaving: number | undefined
  private looking: ReturnType<typeof setTimeout> | undefined
  private rolling = false
  private pendingRoll = 0
  private ticking: ReturnType<typeof setInterval> | undefined
  private grewWithShift = false
  private readonly keys: Array<string> = []
  private readonly took: Array<{ readonly action: string; readonly ms: number }> = []
  private readonly trail: Array<string> = []
  private readonly began = Date.now()
  private fading: Fiber.Fiber<void> | undefined
  private wheel = 0
  private sideways = 0
  private listening: Fiber.Fiber<void> | undefined
  private lighting: Fiber.Fiber<void, unknown> | undefined
  private sourcing: Fiber.Fiber<void, unknown> | undefined
  private fetching: Fiber.Fiber<void, unknown> | undefined
  private searching: Fiber.Fiber<void, unknown> | undefined

  constructor(options: AppOptions) {
    this.renderer = options.renderer
    this.repo = options.repo
    this.base = options.base
    this.noticeMs = options.noticeMs ?? NOTICE_MS
    this.sessionPath = options.sessionPath
    Object.assign(this.chosen, chosenIn({ ...initialState([]), ...options.chosen }))
    this.held = options.state
    this.display = options.display
    this.painting = options.painting
    this.intents = options.intents
    const { renderer } = options
    Effect.runSync(
      this.display.listen({
        onScroll: (delta) => this.onWheel(delta),
        onPan: (delta) => this.onPanWheel(delta),
        onDrag: (from, to, done) => this.dragged(from, to, done),
        onChip: (key) => this.dispatchTask(this.onKey(asKey(key))),
        onRail: (delta) => this.rollFrom(delta),
      }),
    )
    renderer.on("selection", () => this.copyDragged())
    Effect.runSync(options.display.onWritten((text) => this.readBack(text)))
    Effect.runSync(options.display.onAsked((text) => this.askedBack(text)))
    renderer.keyInput.on("keypress", (key) => this.dispatch(key))
    renderer.keyInput.on("keyrelease", (key) => this.letGo(key))
    renderer.on("destroy", () => this.letGoOfEverything())
    this.startTicking()

    renderer.on("frame", () => this.syncGeometry())
    renderer.on("resize", () => this.resized())
    renderer.setFrameCallback(() => Effect.runPromise(this.applying()))
    const resume = options.resume
    const opensOn = options.opensOn
    if (opensOn !== undefined) this.dispatchTask(this.openedOn(opensOn))
    else if (resume !== undefined) this.dispatchTask(this.resume(resume))
    this.dispatchTask(this.loadPulls())
    if (options.partial === true) this.dispatchTask(this.fillBranches())
  }

  listen(fiber: Fiber.Fiber<void>): void {
    this.listening = fiber
  }

  answered(): void {
    this.dispatchTask(this.noticeAnswers())
  }

  private stopWatching(): void {
    const fiber = this.listening
    this.listening = undefined
    if (fiber !== undefined) Effect.runFork(Fiber.interrupt(fiber))
  }

  private noticeAnswers(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) {
        yield* this.noticeOnList()
        return
      }
      const sent = yield* this.loadSent(branch.branch)
      const said = spokenSince(this.state.sent, sent)
      if (said === 0) return
      this.commit(withWaiting(withArrived(this.state, sent), `${said} answered · press r`))
    })
  }

  private noticeOnList(): Work {
    return Effect.sync(() => this.commit(withWaiting(this.state, "the agent answered · press r")))
  }

  private slowest(): ReadonlyArray<{ readonly action: string; readonly ms: number }> {
    return [...this.took].toSorted((left, right) => right.ms - left.ms).slice(0, SLOWEST_KEPT)
  }

  private dispatchTask(task: Work): void {
    Queue.offerUnsafe(this.intents, Intent.Task({ run: task }))
  }

  consume(): Effect.Effect<void, never, Needs> {
    return Stream.runForEach(Stream.fromQueue(this.intents), (intent) => this.act(intent))
  }

  private act(intent: Intent): Effect.Effect<void, never, Needs> {
    const began = Date.now()
    return this.answer(intent).pipe(
      Effect.catchCause((cause) => Effect.sync(() => this.fail(Cause.squash(cause)))),
      Effect.ensuring(Effect.sync(() => this.timed(began))),
    )
  }

  private timed(began: number): void {
    const ms = Date.now() - began
    if (ms < WORTH_TIMING_MS) return
    this.took.push({ action: this.trail.at(-1)?.trim().split(/\s+/)[1] ?? "a key", ms })
    if (this.took.length > TIMES_KEPT) this.took.shift()
  }

  private answer(intent: Intent): Work {
    return Intent.$match(intent, {
      Key: ({ key }) => this.onKey(key),
      Task: ({ run }) => run,
      Ping: ({ done }) => Effect.asVoid(Deferred.succeed(done, undefined)),
    })
  }

  private openedOn(branchIndex: number): Work {
    return Effect.gen({ self: this }, function* () {
      if (branchIndex >= this.state.branches.length) return
      this.write({ ...this.state, branchIndex })
      yield* this.openBranch()
      yield* this.loadSource()
    })
  }

  private resume(session: Session): Work {
    return Effect.gen({ self: this }, function* () {
      const branches = this.state.branches
      if (session.branchIndex >= branches.length) return
      this.write({ ...this.state, branchIndex: session.branchIndex })
      yield* this.openBranch()
      const patchIndex = Math.min(session.patchIndex, Math.max(0, this.state.patches.length - 1))
      this.commit(resumedAt(this.state, patchIndex, session.cursor, session.top))
      yield* this.loadSource()
    })
  }

  private rememberChosen(next: TuiState): void {
    for (const [name, value] of Object.entries(chosenIn(next))) {
      if (this.chosen[name] === value) continue
      this.chosen[name] = value
      this.dispatchTask(savePreference(name, value).pipe(Effect.asVoid, Effect.orElseSucceed(() => undefined)))
    }
  }

  private rememberPlace(next: TuiState): void {
    if (this.sessionPath === undefined || next.screen !== "review") return
    const session = sessionOf(next)
    const line = JSON.stringify(session)
    if (line === this.remembered) return
    this.remembered = line
    Effect.runFork(writeSession(this.sessionPath, session))
  }

  private dispatch(key: KeyEvent): void {
    if (key.eventType === "release") {
      this.letGo(key)
      return
    }
    if (this.renderer.hasSelection) this.renderer.clearSelection()
    Queue.offerUnsafe(this.intents, Intent.Key({ key }))
  }

  private letGo(key: KeyEvent): void {
    if (!key.name.endsWith("shift") || !this.grewWithShift) return
    this.grewWithShift = false
    Queue.offerUnsafe(this.intents, Intent.Key({ key: asKey("c") }))
  }

  private fail(cause: unknown): void {
    this.failure = cause instanceof Error ? `${cause.message}\n${cause.stack ?? ""}` : String(cause)
    this.failureKind = cause instanceof Error ? cause.name : "a failure with no name"
  }

  lastFailure(): string {
    return this.failure
  }

  shown(): TuiState {
    return this.state
  }

  private pinged(): Effect.Effect<void> {
    const done = Deferred.makeUnsafe<void>()
    Queue.offerUnsafe(this.intents, Intent.Ping({ done }))
    return Deferred.await(done)
  }

  private drained(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      for (let pass = 0; pass < DRAIN_PASSES; pass += 1) {
        yield* this.pinged()
        if (Queue.sizeUnsafe(this.intents) === 0) return
      }
    })
  }

  settled(): Promise<void> {
    if (this.consuming === undefined) return Promise.resolve()
    return Effect.runPromise(
      Effect.andThen(
        Effect.andThen(
          Effect.andThen(this.drained(), Effect.suspend(() => this.stillSourcing())),
          Effect.suspend(() => this.stillFetching()),
        ).pipe(Effect.andThen(Effect.suspend(() => this.stillSearching()))),
        Effect.suspend(() => this.stillLighting()),
      ),
    )
  }

  private stillFetching(): Effect.Effect<void> {
    const fiber = this.fetching
    return fiber === undefined ? Effect.void : Effect.asVoid(Fiber.await(fiber))
  }

  private stillSearching(): Effect.Effect<void> {
    const fiber = this.searching
    return fiber === undefined ? Effect.void : Effect.asVoid(Fiber.await(fiber))
  }

  private stillSourcing(): Effect.Effect<void> {
    const fiber = this.sourcing
    return fiber === undefined ? Effect.void : Effect.asVoid(Fiber.await(fiber))
  }

  private stillLighting(): Effect.Effect<void> {
    const fiber = this.lighting
    return fiber === undefined ? Effect.void : Effect.asVoid(Fiber.await(fiber))
  }

  private onWheel(delta: number): void {
    this.wheel += delta
    this.renderer.requestRender()
  }

  private onPanWheel(delta: number): void {
    this.sideways += delta
    this.renderer.requestRender()
  }

  private applying(): Effect.Effect<void> {
    return Effect.sync(() => this.applyWheel())
  }

  private applyWheel(): void {
    const down = this.wheel
    const across = this.sideways
    if (down === 0 && across === 0) return
    this.wheel = 0
    this.sideways = 0
    if (listens(this.state.screen)) {
      if (down !== 0) this.commit(paletteMoved(this.state, down))
      return
    }
    const moved = down === 0 ? this.measured() : scrolled(this.standing(), down)
    this.commit(across === 0 ? moved : panBy(moved, across))
  }

  private resized(): void {
    Effect.runSync(this.display.paint(this.state))
    this.syncGeometry()
  }

  private syncGeometry(): void {
    const rows = Effect.runSync(this.display.rows)
    if (rows !== this.state.viewport) {
      this.commit({ ...this.state, viewport: rows })
      return
    }
    const columns = Effect.runSync(this.display.columns)
    if (columns !== this.state.columns) {
      this.commit(withColumns(this.state, columns))
      return
    }
    const tallest = Effect.runSync(this.display.tallest)
    if (tallest !== this.state.tallest) {
      this.commit({ ...this.state, tallest })
      return
    }
    const railRows = Effect.runSync(this.display.rail)
    if (railRows !== this.state.railRows) {
      this.commit({ ...this.state, railRows })
      return
    }
    const room = Effect.runSync(this.display.room)
    if (room === this.roomed) return
    this.roomed = room
    Effect.runSync(this.display.paint(this.state))
  }

  private standing(): TuiState {
    const held = this.measured()
    return held.scroll >= 0 ? held : { ...held, scroll: Effect.runSync(this.display.at) }
  }

  private measured(): TuiState {
    return { ...this.state, viewport: Effect.runSync(this.display.rows) }
  }

  private get state(): TuiState {
    return SubscriptionRef.getUnsafe(this.held)
  }

  private write(next: TuiState): void {
    Effect.runSync(SubscriptionRef.set(this.held, next))
  }

  private since(): number {
    return Date.now() - this.began
  }

  private commit(given: TuiState): void {
    const next = given.patchIndex === this.state.patchIndex ? given : turnedOver(given)
    this.turnWriting(next)
    const appeared = next.notice.length > 0 && next.notice !== this.state.notice
    if (appeared) this.recordNotice(next.notice)
    this.rememberPlace(next)
    this.rememberChosen(next)
    this.write(next)
    if (appeared) this.fade()
  }

  private recordNotice(notice: string): void {
    this.trail.push(noticeOf(notice, this.since()))
    if (this.trail.length > TRAIL_HISTORY) this.trail.shift()
  }

  private stopPainting(): void {
    Effect.runFork(Fiber.interrupt(this.painting))
  }

  private stopConsuming(): void {
    const fiber = this.consuming
    this.consuming = undefined
    if (fiber !== undefined) Effect.runFork(Fiber.interrupt(fiber))
  }

  watch(fiber: Fiber.Fiber<void>): void {
    this.consuming = fiber
  }

  private stopLighting(): void {
    const fiber = this.lighting
    this.lighting = undefined
    if (fiber !== undefined) Effect.runFork(Fiber.interrupt(fiber))
  }

  private startTicking(): void {
    this.commit({ ...this.state, now: Date.now() })
    this.ticking = setInterval(() => {
      this.commit({ ...this.state, now: Date.now() })
    }, AGE_TICK_MS)
    this.ticking.unref?.()
  }

  private stopTicking(): void {
    if (this.ticking === undefined) return
    clearInterval(this.ticking)
    this.ticking = undefined
  }

  private stopFading(): void {
    const fiber = this.fading
    this.fading = undefined
    if (fiber !== undefined) Effect.runFork(Fiber.interrupt(fiber))
  }

  private clearing(): Effect.Effect<void> {
    return Effect.gen({ self: this }, function* () {
      yield* Effect.sleep(this.noticeMs)
      this.fading = undefined
      if (this.state.notice.length > 0) this.commit({ ...this.state, notice: "" })
    })
  }

  private fade(): void {
    this.stopFading()
    this.fading = Effect.runFork(this.clearing())
  }

  private effects(): Readonly<Partial<Record<Action, () => Work>>> {
    return {
      quit: () => Effect.sync(() => this.renderer.destroy()),
      "branch.open": () => this.openBranch(),
      "branch.pull": () => this.showPull(),
      "compose.open": () => this.compose(),
      "compose.submit": () => this.send(),
      "held.send": () => this.sendHeld(),
      "palette.run": () => this.runChoice(),
      "comment.next": () => this.walkComments(1),
      "comment.prev": () => this.walkComments(-1),
      "file.next": () => this.moveFile(1),
      "file.prev": () => this.moveFile(-1),
      "cursor.next": () => this.stepped(1),
      "cursor.prev": () => this.stepped(-1),
      "rail.toggle": () => this.commitSynced("rail.toggle"),
      "layers.ask": () => this.askForLayers(),
      "file.vouch": () => this.vouch(false),
      "file.vouch.next": () => this.vouch(true),
      "thread.settle": () => this.settleHere(),
      "thread.settleRead": () => this.settleWhatIsRead(),
      "thread.remove": () => this.removeHere(),
      "thread.reply": () => this.replyHere(),
      "remark.accept": () => this.acceptRemarkHere(),
      "selection.copy": () => Effect.sync(() => this.copySelection(false)),
      "search.open": () => this.findSelection(),
      "search.jump": () => this.runFinder(),
      "review.reload": () =>
        this.state.screen === "branches" ? this.reloadList() : this.reloadBranch(),
      "base.open": () => this.openBases(),
      "base.set": () => (this.state.screen === "editor" ? this.editorChosen() : this.setBaseHere()),
      "base.clear": () => (this.state.screen === "editor" ? this.forgetEditor() : this.clearBaseHere()),
      "line.open": () => this.openInEditor(),
      "editor.open": () => this.chooseEditor(),
      "report.open": () => Effect.sync(() => this.commit(reduce(this.measured(), "report.open"))),
      back: () => this.goBack(),
      "report.send": () => this.sendReport(),
      "context.more": () => this.expand(1),
      "context.less": () => this.expand(-1),
      "context.whole": () => this.widen(contextToggled(this.state)),
      "tree.expand": () => this.unfold(1),
      "tree.collapse": () => this.unfold(-1),
      "match.next": () => this.walkMatches(1),
      "match.prev": () => this.walkMatches(-1),
    }
  }

  private walkMatches(delta: number): Work {
    return Effect.gen({ self: this }, function* () {
      this.commit(reduce(this.measured(), delta > 0 ? "match.next" : "match.prev"))
      yield* this.readAround()
    })
  }

  private unfold(delta: number): Work {
    return Effect.gen({ self: this }, function* () {
      const gap =
        this.state.focus === "diff" ? gapAtRow(this.state, this.state.cursor) : undefined
      const action: Action = delta > 0 ? "tree.expand" : "tree.collapse"
      if (gap === undefined) {
        this.commit(reduce(this.measured(), action))
        return
      }
      if (delta > 0) yield* this.loadFull()
      this.commit(gapOpened(this.measured(), gap.index, delta * GAP_CHUNK))
    })
  }

  private loadFull(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      const patch = selectedPatch(this.state)
      if (branch === undefined || patch === undefined) return
      if (this.state.full.some((one) => one.path === patch.path)) return
      const worktree = this.worktreeFor(branch.branch)
      const full =
        worktree === undefined
          ? yield* listPatches(this.repo, branch.branch, WHOLE_FILE, patch.path)
          : yield* patchIn(worktree, WHOLE_FILE, patch.path)
      this.commit(withFull(this.state, [...this.state.full, ...full]))
    })
  }

  private onKey(key: KeyEvent, forced?: Action): Work {
    return Effect.gen({ self: this }, function* () {
      if (forced === undefined && keyName(key) === "ctrl+c") {
        yield* this.askedToLeave()
        return
      }
      this.forgetLeaving()
      const action = forced ?? actionFor(this.state.screen, keyName(key), this.state.focus)
      this.grewWithShift = action === "select.grow" || action === "select.shrink"
      this.remember(action, key)
      if (action === undefined) {
        this.onText(key)
        return
      }
      const effect = this.effects()[action]
      if (effect === undefined) {
        this.commit(reduce(this.measured(), action))
        return
      }
      yield* effect()
    })
  }

  private onText(key: KeyEvent): void {
    if (!listens(this.state.screen)) return
    if (key.name === "down" || key.name === "up") {
      this.commit(paletteMoved(this.state, key.name === "down" ? 1 : -1))
    }
  }

  private turnWriting(next: TuiState): void {
    if (listens(next.screen) !== listens(this.state.screen) || next.screen !== this.state.screen) {
      Effect.runSync(this.display.askOn(listens(next.screen) ? next.screen : undefined))
    }
    const was = writesInto(this.state.screen)
    const now = writesInto(next.screen)
    if (was === now) {
      if (now && next.draftAt !== this.state.draftAt) {
        Effect.runSync(this.display.write(next.draft))
      }
      return
    }
    if (now) Effect.runSync(this.display.write(next.draft))
    Effect.runSync(this.display.writeOn(now))
  }

  private askedBack(text: string): void {
    const clean = legible(text).replaceAll("\n", " ")
    if (clean !== text) {
      Effect.runSync(this.display.askWith(clean))
      return
    }
    if (!listens(this.state.screen) || clean === this.state.query) return
    this.commit({ ...this.state, query: clean, paletteIndex: 0, refIndex: 0 })
    if (this.state.screen === "search") this.lookSoon(clean)
  }

  private readBack(text: string): void {
    const clean = legible(stripAnsiSequences(text))
    if (clean !== text) {
      Effect.runSync(this.display.write(clean))
      return
    }
    if (text === this.state.draft) return
    this.commit(withDraft(this.state, text))
  }

  private openBases(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      const refs = yield* listRefs(this.repo)
      this.commit(withRefs(this.state, refs.filter((ref) => ref !== branch.branch)))
    })
  }

  private basedOnRef(ref: string): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      const held = yield* Effect.result(setBase(this.repo, branch.branch, ref))
      if (Result.isFailure(held)) {
        this.commit(withNotice(this.state, `${ref} names nothing here`))
        return
      }
      yield* this.afterBase(branch.branch, `based on ${ref}`)
    })
  }

  private clearBaseHere(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      yield* clearBase(this.repo, branch.branch)
      yield* this.afterBase(branch.branch, "the base is adiff's guess again")
    })
  }

  private afterBase(branch: string, said: string): Work {
    return Effect.gen({ self: this }, function* () {
      const listed = yield* listBranches(this.repo, this.base)
      const back = { ...this.state, screen: this.state.returnTo, query: "" }
      const held = withBranches(back, listed)
      const at = listed.findIndex((one) => one.branch === branch)
      this.commit(withNotice(at === -1 ? held : { ...held, branchIndex: at }, said))
      if (this.state.screen !== "review") return
      this.commit(yield* this.readBranch(branch))
      yield* this.fetchRemarks()
      yield* this.loadSource()
    })
  }

  private setBaseHere(): Work {
    const ref = refHere(this.state)
    return ref === undefined ? Effect.void : this.basedOnRef(ref)
  }

  private runChoice(): Work {
    return Effect.gen({ self: this }, function* () {
      const chosen = paletteChoice(this.state)
      const closed = paletteClosed(this.state)
      if (chosen === undefined) {
        this.commit(closed)
        return
      }
      this.write(closed)
      yield* this.onKey({ name: "", ctrl: false, sequence: "" } as KeyEvent, chosen)
    })
  }

  private readBranch(name: string): Work<TuiState> {
    return Effect.gen({ self: this }, function* () {
      const reading = yield* readingOf(this.repo, name, this.base)
      this.reading = reading
      const [progress, layers, sent, remarks] = yield* Effect.all(
        [
          progressIn(reading),
          layersIn(reading),
          sentIn(reading),
          this.state.remarksOn
            ? remarksHeldIn(reading)
            : Effect.succeed([] as ReadonlyArray<Remark>),
        ],
        { concurrency: "unbounded" },
      )
      const opened = withVouched(withPatches(this.state, reading.patches), progress.vouched)
      return withRemarks(withLayers(withSent(opened, sent), layers), remarks)
    })
  }

  private remarksHeld(reading: BranchReading): Work<ReadonlyArray<Remark>> {
    return this.state.remarksOn
      ? remarksHeldIn(reading)
      : Effect.succeed([] as ReadonlyArray<Remark>)
  }

  private fetchRemarks(): Work {
    return Effect.gen({ self: this }, function* () {
      this.stopFetching()
      if (!this.state.remarksOn || this.reading === undefined) return
      this.fetching = yield* Effect.forkDetach(this.readRemarks(this.reading))
    })
  }

  private stopFetching(): void {
    const fiber = this.fetching
    this.fetching = undefined
    if (fiber !== undefined) Effect.runFork(Fiber.interrupt(fiber))
  }

  private readRemarks(reading: BranchReading): Work {
    return Effect.gen({ self: this }, function* () {
      const said = this.state.waiting
      this.commit(withWaiting(this.state, READING_PULL))
      const found = yield* Effect.result(remarksIn(this.repo, reading))
      if (this.reading !== reading) return
      const rested = withWaiting(this.state, said)
      const hasPull = (this.state.pulls[reading.worktree.branch] ?? "").length > 0
      if (Result.isFailure(found)) {
        this.commit(hasPull ? withNoticeHere(rested, FORGE_QUIET) : rested)
        return
      }
      this.commit(withRemarks(rested, Result.getOrElse(found, () => this.state.remarks)))
    })
  }

  private openBranch(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      this.commit(yield* this.readBranch(branch.branch))
      yield* this.fetchRemarks()
      yield* this.loadSource()
    })
  }

  private dragged(from: Spot, to: Spot, done: boolean): void {
    const held = this.measured()
    if (restsWhereItLanded(from, to) && !this.selectingNow) {
      this.commit(restingOn(held, from.row))
      return
    }
    const along = from.row === to.row
    this.selectingNow = !done
    this.commit(
      along ? pickedIn(held, from.row, from.column, to.column) : draggedTo(held, from.row, to.row),
    )
    if (done) this.copySelection(true)
  }

  private copyDragged(): void {
    const taken = this.renderer.getSelection()?.getSelectedText() ?? ""
    if (taken.trim().length === 0) return
    copyToClipboard(taken)
    const lines = taken.split("\n").length
    const said = lines === 1 ? `${taken.length} characters copied` : `${lines} lines copied`
    this.commit(withNoticeHere(this.state, said))
  }

  private copySelection(keep: boolean): void {
    const said = keep ? withNoticeHere : withNotice
    const thread = this.state.selecting ? undefined : threadAtStop(this.state)
    if (thread !== undefined) {
      copyToClipboard(`${thread.body}\n`)
      this.commit(said(this.state, "comment copied"))
      return
    }
    const taken = pickedText(this.state)
    if (taken !== undefined) {
      copyToClipboard(taken)
      this.commit(said(this.state, `${taken.length} characters copied`))
      return
    }
    const lines = this.state.selecting ? selectedLines(this.state) : lineUnder(this.state)
    if (lines.length === 0) {
      this.commit(withNoticeHere(this.state, "nothing to copy"))
      return
    }
    copyToClipboard(`${lines.join("\n")}\n`)
    const many = lines.length === 1 ? "1 line copied" : `${lines.length} lines copied`
    this.commit(said(this.state, many))
  }

  private findSelection(): Work {
    return Effect.sync(() => {
      const seed = seedFor(pickedText(this.state))
      this.commit(withFinder(this.state, seed))
      Effect.runSync(this.display.askWith(seed))
    })
  }

  private lookSoon(wanted: string): void {
    this.stopLooking()
    this.looking = setTimeout(() => {
      this.looking = undefined
      const asked = wanted.trim()
      if (this.state.screen !== "search" || this.state.query.trim() !== asked) return
      this.dispatchTask(asked.length < LEAST_TERM ? this.forgetMatches() : this.searchAside(asked))
    }, LOOK_MS)
  }

  private stopLooking(): void {
    if (this.looking === undefined) return
    clearTimeout(this.looking)
    this.looking = undefined
  }

  private forgetMatches(): Work {
    return Effect.sync(() =>
      this.commit(
        withMatches(this.state, { matches: [], counted: NOTHING_COUNTED, left: 0 }, ""),
      ),
    )
  }

  private runFinder(): Work {
    return Effect.gen({ self: this }, function* () {
      const wanted = this.state.query.trim()
      if (wanted.length < LEAST_TERM) return
      if (wanted !== this.state.term) {
        this.stopLooking()
        yield* this.lookFor(wanted)
        return
      }
      yield* this.openMatch()
    })
  }

  private searchAside(wanted: string): Work {
    return Effect.gen({ self: this }, function* () {
      this.stopSearching()
      this.searching = yield* Effect.forkDetach(this.lookFor(wanted))
    })
  }

  private stopSearching(): void {
    const fiber = this.searching
    this.searching = undefined
    if (fiber !== undefined) Effect.runFork(Fiber.interrupt(fiber))
  }

  private lookFor(wanted: string): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      const reading = this.reading
      const here = selectedPatch(this.state)?.path ?? ""
      const found =
        reading === undefined || reading.worktree.branch !== branch.branch
          ? yield* searchBranch(this.repo, branch.branch, wanted, here)
          : yield* searchIn(reading, wanted, here)
      if (this.state.screen !== "search" || this.state.query.trim() !== wanted) return
      this.commit(withMatches(this.state, found, wanted))
      yield* this.readAround()
    })
  }

  private readAround(): Work {
    return Effect.gen({ self: this }, function* () {
      const reading = this.reading
      const match = matchHere(this.state)
      if (reading === undefined || match === undefined) return
      const lines = yield* aroundIn(reading, match.path, match.line)
      const still = matchHere(this.state)
      if (still?.path !== match.path || still.line !== match.line) return
      this.commit(withAround(this.state, lines))
    })
  }

  private openMatch(): Work {
    return Effect.gen({ self: this }, function* () {
      const match = matchHere(this.state)
      if (match === undefined) return
      const at = this.state.patches.findIndex((patch) => patch.path === match.path)
      const patch = this.state.patches[at]
      if (patch === undefined) {
        this.commit(withNoticeHere(this.state, `${match.path} is not changed on this branch`))
        return
      }
      const landed = atFile({ ...this.state, screen: "review", matches: [], term: "" }, at)
      const shown = selectedPatch(landed)
      const showing = shown !== undefined && rowShowing(shown, match.line) !== undefined
      const opened = showing ? landed : { ...landed, revealed: allRevealed(landed) }
      const found = selectedPatch(opened) ?? patch
      this.commit({ ...opened, cursor: rowAtSourceLine(found, match.line) })
      yield* this.loadSource()
    })
  }

  private compose(): Work {
    return Effect.gen({ self: this }, function* () {
      if (this.state.focus !== "review") {
        this.commit(reduce(this.measured(), "compose.open"))
        return
      }
      yield* this.openPanelEntry()
    })
  }

  private openPanelEntry(): Work {
    return Effect.gen({ self: this }, function* () {
      const entry = panelEntry(this.state)
      if (entry === undefined) {
        this.commit(withNoticeHere(this.state, "nothing in the review yet"))
        return
      }
      if (entry.kind === "fold") {
        this.commit({ ...this.state, openMoved: !entry.open })
        return
      }
      if (entry.kind === "remark") {
        yield* this.openRemark(entry.remark)
        return
      }
      const at = this.state.patches.findIndex((patch) => patch.path === entry.comment.file)
      const patch = this.state.patches[at]
      if (patch === undefined) {
        yield* this.readAnswers(entry.comment.id)
        this.commit(withNoticeHere(this.state, `${entry.comment.file} is not on this branch`))
        return
      }
      const opened = { ...this.measured(), patchIndex: at }
      const shown = selectedPatch(opened)
      if (shown !== undefined && rowShowing(shown, entry.comment.end) === undefined) {
        yield* this.jumpingPastGaps(opened, at, entry)
        return
      }
      this.commit(openedAt(this.measured(), at, entry.comment.end))
      yield* this.turnedTo()
      yield* this.readAnswers(entry.comment.id)
    })
  }

  private jumpingPastGaps(
    opened: TuiState,
    at: number,
    entry: Extract<PanelEntry, { kind: "comment" }>,
  ): Work {
    return Effect.gen({ self: this }, function* () {
      const wide = { ...opened, revealed: allRevealed(opened) }
      const shown = selectedPatch(wide)
      if (shown === undefined || rowShowing(shown, entry.comment.end) === undefined) {
        yield* this.readAnswers(entry.comment.id)
        this.commit(withNoticeHere(this.state, "the diff no longer has that line · the panel shows the code it was written on"))
        return
      }
      this.commit(openedAt({ ...this.measured(), revealed: wide.revealed }, at, entry.comment.end))
      yield* this.turnedTo()
      yield* this.readAnswers(entry.comment.id)
    })
  }

  private readAnswers(id: string | undefined): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (id === undefined || branch === undefined) return
      yield* markRead(this.repo, branch.branch, id)
      const held = this.state.panelIndex
      const sent = yield* this.loadSent(branch.branch)
      this.commit({ ...withSent(this.state, sent), panelIndex: held })
    })
  }

  private settleWhatIsRead(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      const done = yield* settleRead(this.repo, branch.branch, new Date().toISOString())
      if (done.settled === 0) {
        this.commit(withNotice(this.state, "nothing read is waiting to be settled"))
        return
      }
      const sent = yield* this.loadSent(branch.branch)
      const said = `settled ${done.settled} read comment${done.settled === 1 ? "" : "s"}`
      this.commit(withNotice(withSent(this.state, sent), said))
    })
  }

  private settleHere(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      const thread = threadHere(this.state)
      const id = thread?.id
      if (branch === undefined || id === undefined) {
        this.commit(withNotice(this.state, "no thread here"))
        return
      }
      const was = this.state.panelIndex
      yield* this.settling(branch.branch, id)
      const sent = yield* this.loadSent(branch.branch)
      const held = withSent({ ...this.state, opened: this.state.opened.filter((one) => one !== id) }, sent)
      this.commit(withNotice(this.staying(held, was), "settled"))
    })
  }

  private replyHere(): Work {
    return Effect.sync(() => {
      const thread = threadHere(this.state)
      if (thread?.id !== undefined) {
        this.commit({ ...this.state, screen: "compose", draft: "", replyTo: thread.id })
        return
      }
      const remark = remarkToTakeOn(this.state)
      if (remark === undefined) {
        this.commit(withNotice(this.state, "no thread here"))
        return
      }
      this.commit({ ...this.state, screen: "compose", draft: "", answerTo: remark.id })
    })
  }

  private sendRemarkAnswer(to: string): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      if (this.state.draft.trim().length === 0) {
        this.commit(withNotice(this.state, NOTHING_WRITTEN))
        return
      }
      const said = yield* this.display.written
      const done = yield* Effect.as(
        answerRemark({ repo: this.repo, branch: branch.branch, id: to, body: said }),
        true,
      ).pipe(Effect.catchTag("ForgeUnavailable", () => Effect.succeed(false)))
      const clear = { ...sentAway(this.state), answerTo: undefined }
      if (!done) {
        this.commit(withNotice(clear, "the forge would not take that reply"))
        return
      }
      this.commit(clear)
      yield* this.reloadFromForge("replied on the pull request")
    })
  }

  private reloadFromForge(said: string): Work {
    return Effect.gen({ self: this }, function* () {
      const reading = this.reading
      if (reading === undefined) return
      const remarks = yield* Effect.orElseSucceed(
        remarksIn(this.repo, reading),
        () => this.state.remarks,
      )
      this.commit(withNoticeHere(withRemarks(this.state, remarks), said))
    })
  }

  private staying(state: TuiState, was: number): TuiState {
    const last = Math.max(0, panelEntries(state).length - 1)
    return { ...state, panelIndex: Math.min(was, last) }
  }

  private heldUnderCursor(): number {
    if (this.state.focus !== "review") return -1
    const entry = panelEntry(this.state)
    if (entry === undefined || entry.kind !== "comment" || entry.section !== "held") return -1
    return this.state.held.indexOf(entry.comment)
  }

  private openRemark(remark: Remark): Work {
    return Effect.gen({ self: this }, function* () {
      const at = this.state.patches.findIndex((patch) => patch.path === remark.file)
      const patch = this.state.patches[at]
      if (patch === undefined || !remark.placed) {
        this.commit(withNoticeHere(this.state, `${remark.file} is not in this diff`))
        return
      }
      this.commit(openedAt(this.measured(), at, remark.end))
      yield* this.turnedTo()
    })
  }

  private acceptRemarkHere(): Work {
    return Effect.gen({ self: this }, function* () {
      const remark = remarkHere(this.state)
      const reading = this.reading
      if (remark === undefined || reading === undefined) {
        this.commit(withNoticeHere(this.state, "no remark here"))
        return
      }
      if (this.state.hold) {
        this.holding({
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
        this.commit(withNoticeHere(this.state, "that remark is already a comment of yours"))
        return
      }
      yield* this.reloadRemarks("accepted, the agent has it")
    })
  }

  private dismissRemarkHere(remark: Remark, back: boolean): Work {
    return Effect.gen({ self: this }, function* () {
      const reading = this.reading
      if (reading === undefined) return
      const at = new Date().toISOString()
      yield* back
        ? undismissIn(reading.worktree.path, remark.id)
        : dismissIn(reading.worktree.path, remark.id, at)
      yield* this.reloadRemarks(back ? "restored" : "dismissed, it is under Dismissed")
    })
  }

  private reloadRemarks(said: string): Work {
    return Effect.gen({ self: this }, function* () {
      const reading = this.reading
      if (reading === undefined) return
      const [remarks, sent] = yield* Effect.all([this.remarksHeld(reading), sentIn(reading)], {
        concurrency: "unbounded",
      })
      const held = this.staying(withRemarks(withSent(this.state, sent), remarks), this.state.panelIndex)
      this.commit(withNoticeHere(held, said))
    })
  }

  private removeHere(): Work {
    return Effect.gen({ self: this }, function* () {
      const waitingHeld = this.heldUnderCursor()
      const triaged = waitingHeld === -1 ? remarkUnderCursor(this.state) : undefined
      if (triaged !== undefined) {
        yield* this.dismissRemarkHere(triaged.remark, triaged.dismissed)
        return
      }
      const waiting = this.heldUnderCursor()
      if (waiting !== -1) {
        yield* this.dropHeld(waiting)
        return
      }
      const branch = selectedBranch(this.state)
      const thread = threadHere(this.state)
      const id = thread?.id
      if (branch === undefined || id === undefined) {
        this.commit(withNotice(this.state, "no thread here"))
        return
      }
      yield* this.turningOver(branch.branch, id, thread?.removed === true)
    })
  }

  private turningOver(branch: string, id: string, back: boolean): Work {
    return Effect.gen({ self: this }, function* () {
      const was = this.state.panelIndex
      yield* back ? this.restoring(branch, id) : this.removing(branch, id)
      const sent = yield* this.loadSent(branch)
      const kept = { ...this.state, opened: this.state.opened.filter((one) => one !== id) }
      const said = back ? "restored" : "removed, it is under Removed in the review"
      const held = this.reading
      const remarks = held === undefined ? this.state.remarks : yield* this.remarksHeld(held)
      this.commit(
        withNotice(this.staying(withRemarks(withSent(kept, sent), remarks), was), said),
      )
    })
  }

  private fillBranches(): Work {
    return Effect.gen({ self: this }, function* () {
      const here = selectedBranch(this.state)?.branch
      const branches = yield* (listBranches(this.repo, this.base))
      const read = withBranches(this.state, branches)
      const at = branches.findIndex((candidate) => candidate.branch === here)
      this.commit(at === -1 ? read : { ...read, branchIndex: at })
      this.dispatchTask(this.loadPulls())
    })
  }

  private reloadList(): Work {
    return Effect.gen({ self: this }, function* () {
      const here = selectedBranch(this.state)?.branch
      const branches = yield* (listBranches(this.repo, this.base))
      const read = withBranches(this.state, branches)
      const at = branches.findIndex((candidate) => candidate.branch === here)
      const kept = at === -1 ? read : { ...read, branchIndex: at }
      this.commit(withWaiting(withNoticeHere(kept, "read the list again"), ""))
      this.dispatchTask(this.loadPulls())
    })
  }

  private reloadBranch(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      const path = selectedPatch(this.state)?.path
      const line = sourceLineAt(this.state, this.state.cursor)
      const offset = this.state.cursor - this.state.top
      const read = yield* this.readBranch(branch.branch)
      const held = restoredTo(read, path, line, offset)
      this.commit(withWaiting(withNotice(held, "read the branch again"), ""))
      yield* this.fetchRemarks()
      yield* this.loadSource()
    })
  }

  private goBack(): Work {
    return Effect.gen({ self: this }, function* () {
      const next = reduce(this.measured(), "back")
      this.commit(next)
      if (next.screen !== "branches") return
      this.commit(withBranches(this.state, yield* (listBranches(this.repo, this.base))))
    })
  }

  private walkComments(delta: number): Work {
    return Effect.gen({ self: this }, function* () {
      const was = this.state.patchIndex
      this.commit(reduce(this.measured(), delta > 0 ? "comment.next" : "comment.prev"))
      if (this.state.patchIndex !== was) yield* this.turnedTo()
    })
  }

  private rollFrom(delta: number): void {
    if (!onLayers(this.state)) {
      this.dispatchTask(this.rolled(delta))
      return
    }
    if (this.rolling) {
      this.pendingRoll = delta
      return
    }
    this.rolling = true
    this.dispatchTask(this.rolled(delta))
  }

  private stepped(delta: number): Work {
    return Effect.gen({ self: this }, function* () {
      if (this.paged(delta)) return
      this.catchUp()
      yield* this.commitSynced(delta > 0 ? "cursor.next" : "cursor.prev")
    })
  }

  private catchUp(): void {
    const state = this.state
    if (state.screen !== "review" || state.focus !== "diff" || state.scroll < 0) return
    const last = state.scroll + Math.max(1, Effect.runSync(this.display.rows)) - 1
    const at = Effect.runSync(this.display.screenRowOf(state.cursor)) ?? last
    if (at >= state.scroll && at <= last) return
    const wanted = at < state.scroll ? state.scroll : last
    const top = Effect.runSync(this.display.rowAt(state.scroll))
    this.commit({ ...state, cursor: Effect.runSync(this.display.rowAt(wanted)), stop: 0, top })
  }

  private paged(delta: number): boolean {
    if (this.state.screen !== "review" || this.state.focus !== "diff") return false
    const state = this.standing()
    const span = Effect.runSync(this.display.block(state.cursor, state.stop))
    const height = Math.max(1, state.viewport)
    if (span.rows <= height) return false
    const room = delta > 0 ? span.start + span.rows - height : span.start
    if (delta > 0 ? state.scroll >= room : state.scroll <= room) return false
    this.commit(scrolled(state, delta * Math.max(1, height - 2)))
    return true
  }

  private commitSynced(action: Action): Work {
    return Effect.gen({ self: this }, function* () {
      const was = this.state.patchIndex
      this.commit(reduce(this.measured(), action))
      if (this.state.patchIndex !== was) yield* this.turnedTo()
    })
  }

  private rolled(delta: number): Work {
    return Effect.gen({ self: this }, function* () {
      const was = this.state.patchIndex
      this.commit(railScrolled(this.measured(), delta))
      if (this.state.patchIndex !== was) yield* this.turnedTo()
    }).pipe(Effect.ensuring(Effect.sync(() => this.rolledOn())))
  }

  private rolledOn(): void {
    this.rolling = false
    const held = this.pendingRoll
    this.pendingRoll = 0
    if (held !== 0) this.rollFrom(held > 0 ? 1 : -1)
  }

  private moveFile(delta: number): Work {
    return this.commitSynced(delta > 0 ? "file.next" : "file.prev")
  }

  private vouch(advance: boolean): Work {    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      const patch = selectedPatch(this.state)
      if (branch === undefined || patch === undefined) return
      if (advance && this.readHere()) {
        this.commit(alongFrom(this.state))
        return
      }
      const report = yield* this.vouching(branch.branch, patch.path)
      const next = withVouched(this.state, report.vouched, report.parts)
      if (!advance) {
        this.commit(withNotice(next, this.markedSaid(report, patch.path)))
        return
      }
      this.movedOn(next, patch.path)
    })
  }

  private markedSaid(report: VouchReport, path: string): string {
    const part = this.partHereNow()
    const marked = part === undefined ? report.vouched.includes(path) : report.parts.includes(part)
    return marked ? `marked ${path}` : `unmarked ${path}`
  }

  private movedOn(next: TuiState, path: string): void {
    const target = nextUnreviewed(next, next.patchIndex)
    if (target === undefined) {
      this.commit(withNotice(next, "every file reviewed"))
      return
    }
    this.commit(withNotice(atFile(next, target), `marked ${path}`))
  }

  private forgetLeaving(): void {
    if (this.leaving === undefined) return
    this.leaving = undefined
    if (this.state.notice === leavingSaid(this.state)) this.commit(withNoticeHere(this.state, ""))
  }

  private askedToLeave(): Work {
    return Effect.sync(() => {
      if (overReview(this.state.screen)) {
        this.leaving = undefined
        this.commit(reduce(this.measured(), "back"))
        return
      }
      if (this.leaving !== undefined && Date.now() - this.leaving < LEAVING_MS) {
        this.renderer.destroy()
        return
      }
      this.leaving = Date.now()
      this.commit(withNotice(this.state, leavingSaid(this.state)))
    })
  }

  private worktreeFor(branch: string): Worktree | undefined {
    const reading = this.reading
    return reading === undefined || reading.worktree.branch !== branch ? undefined : reading.worktree
  }

  private commenting(branch: string, request: CommentRequest): Work<unknown> {
    const worktree = this.worktreeFor(branch)
    return worktree === undefined ? submitComment(request) : commentIn(worktree, request)
  }

  private sending(branch: string, requests: Written): Work<unknown> {
    const worktree = this.worktreeFor(branch)
    return worktree === undefined ? submitComments(requests) : commentsIn(worktree, requests)
  }

  private settling(branch: string, id: string): Work<{ readonly settled: string }> {
    const at = new Date().toISOString()
    const worktree = this.worktreeFor(branch)
    return worktree === undefined
      ? settleThread(this.repo, branch, id, at)
      : settleIn(worktree, id, at)
  }

  private restoring(branch: string, id: string): Work<{ readonly restored: string }> {
    const worktree = this.worktreeFor(branch)
    return worktree === undefined
      ? restoreComment(this.repo, branch, id)
      : restoreIn(worktree, id)
  }

  private removing(branch: string, id: string): Work<{ readonly removed: string }> {
    const at = new Date().toISOString()
    const worktree = this.worktreeFor(branch)
    return worktree === undefined
      ? removeComment(this.repo, branch, id, at)
      : removeIn(worktree, id, at)
  }

  private readHere(): boolean {
    return onLayers(this.state)
      ? readIn(this.state, this.state.layerIndex, this.state.patchIndex)
      : isReviewed(this.state, this.state.patchIndex)
  }

  private partHereNow(): string | undefined {
    if (!onLayers(this.state) || layersHolding(this.state, this.state.patchIndex) < 2) {
      return undefined
    }
    return partHere(this.state, this.state.layerIndex, this.state.patchIndex)
  }

  private vouching(branch: string, file: string): Work<VouchReport> {
    const held = this.reading
    if (held === undefined || held.worktree.branch !== branch) {
      return toggleVouch({ repo: this.repo, branch, file })
    }
    const part = this.partHereNow()
    return part === undefined ? vouchIn(held, file) : vouchPartIn(held, file, part)
  }

  private loadSent(branch: string): Work<TuiState["sent"]> {
    const reading = this.reading
    return reading === undefined || reading.worktree.branch !== branch
      ? listSent(this.repo, branch)
      : sentIn(reading)
  }

  private whereTheLineIs():
    | {
        readonly file: string
        readonly path: string
        readonly root: string
        readonly line: number
      }
    | undefined {
    const branch = selectedBranch(this.state)
    const patch = selectedPatch(this.state)
    if (branch === undefined || patch === undefined) return undefined
    const held = this.worktreeFor(branch.branch)?.path ?? this.repo
    return {
      file: resolve(held, patch.path),
      path: patch.path,
      root: held,
      line: sourceLineAt(this.state, this.state.cursor) ?? 1,
    }
  }

  private chooseEditor(): Work {
    return Effect.gen({ self: this }, function* () {
      const around = editorsAround(onThePath)
      const held = templateFor(yield* editorTold)
      const offered = held === undefined || around.includes(held) ? around : [held, ...around]
      this.commit(withChoices(this.state, offered, "editor", held ?? ""))
    })
  }

  private editorChosen(): Work {
    return Effect.gen({ self: this }, function* () {
      const chosen = refHere(this.state)
      if (chosen === undefined) return
      yield* saveEditor(chosen)
      this.commit({ ...this.state, screen: this.state.returnTo, query: "" })
      yield* this.openInEditor()
    })
  }

  private forgetEditor(): Work {
    return Effect.gen({ self: this }, function* () {
      yield* saveEditor("")
      const back = { ...this.state, screen: this.state.returnTo, query: "" }
      this.commit(withNotice(back, "the editor is the environment's again"))
    })
  }

  private openInEditor(): Work {
    return Effect.gen({ self: this }, function* () {
      const where = this.whereTheLineIs()
      if (where === undefined) return
      const template = templateFor(yield* editorTold)
      const opening =
        template === undefined
          ? undefined
          : openingOf(template, where.file, where.line, where.root)
      if (opening === undefined) {
        yield* this.chooseEditor()
        return
      }
      const said = ranAside(opening.command, opening.args, where.root)
        ? `${where.path}:${where.line} in ${opening.command}`
        : `${opening.command} would not start`
      this.commit(withNoticeHere(this.state, said))
    })
  }

  private showPull(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      if (pullHere(this.state).length === 0) yield* this.loadPulls()
      if (knownToHaveNoPull(this.state)) {
        this.commit(withNoticeHere(this.state, "no pull request for this branch"))
        return
      }
      const forge = yield* Forge
      const asked = forge.openPull(this.repo, branch.branch)
      const opened = yield* (
        asked.pipe(
          Effect.as(true),
          Effect.catchTag("ForgeUnavailable", () => Effect.succeed(false)),
        )
      )
      this.commit(withNoticeHere(this.state, openedPull(pullHere(this.state), opened)))
    })
  }

  private loadPulls(): Work {
    return Effect.gen({ self: this }, function* () {
      const forge = yield* Forge
      const answered = yield* (
        forge.pulls(this.repo).pipe(
          Effect.map(Option.some),
          Effect.catchTag("ForgeUnavailable", () => Effect.succeed(Option.none())),
        )
      )
      this.commit(
        Option.match(answered, {
          onNone: () => withSilentForge(this.state),
          onSome: (pulls) =>
            withPulls(this.state, Object.fromEntries(pulls.map((pull) => [pull.branch, pull.state]))),
        }),
      )
    })
  }

  private turnedTo(): Work {
    return Effect.gen({ self: this }, function* () {
      this.commit(withSource(this.state, []))
      this.stopSourcing()
      this.sourcing = yield* Effect.forkDetach(this.loadSource())
    })
  }

  private letGoOfEverything(): void {
    this.stopWatching()
    this.stopFading()
    this.stopLooking()
    this.stopTicking()
    this.stopLighting()
    this.stopSourcing()
    this.stopFetching()
    this.stopSearching()
    this.stopPainting()
    this.stopConsuming()
    void getTreeSitterClient().destroy()
  }

  private stopSourcing(): void {
    const fiber = this.sourcing
    this.sourcing = undefined
    if (fiber !== undefined) Effect.runFork(Fiber.interrupt(fiber))
  }

  private loadSource(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      const patch = selectedPatch(this.state)
      if (branch === undefined || patch === undefined) return
      const asked = patch.path
      const source = yield* (fileSource(this.repo, branch.branch, asked))
      if (selectedPatch(this.state)?.path !== asked) return
      this.commit(withSource(this.state, source))
      const before = yield* (fileBefore(this.repo, branch.branch, asked))
      if (selectedPatch(this.state)?.path !== asked) return
      this.stopLighting()
      this.lighting = yield* Effect.forkDetach(this.lightUp(asked, source, before))
      yield* this.openTinyGaps()
    })
  }

  private openTinyGaps(): Work {
    return Effect.gen({ self: this }, function* () {
      if (lonelyGaps(this.state).length === 0) return
      yield* this.loadFull()
      const alone = lonelyGaps(this.state)
      if (alone.length === 0) return
      this.commit(alone.reduce((held, gap) => gapShown(held, gap.index, gap.hidden), this.state))
    })
  }

  private lightUp(
    path: string,
    source: ReadonlyArray<string>,
    before: ReadonlyArray<string>,
  ): Work {
    return Effect.gen({ self: this }, function* () {
      yield* this.display.light(path, "new", source)
      if (before.length > 0) yield* this.display.light(path, "old", before)
    })
  }

  private expand(delta: number): Work {
    return this.widen(layerContext(this.state.context, delta))
  }

  private widen(next: number): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined || next === this.state.context) return
      const line = sourceLineAt(this.state, this.state.cursor)
      const worktree = this.worktreeFor(branch.branch)
      const patches =
        worktree === undefined
          ? yield* listPatches(this.repo, branch.branch, next)
          : yield* patchIn(worktree, next)
      const widened = withContext(this.state, next, patches, 0)
      const patch = selectedPatch(widened)
      const cursor = patch === undefined || line === undefined ? 0 : rowAtSourceLine(patch, line)
      const held = this.reading
      const remarks =
        held === undefined
          ? this.state.remarks
          : yield* remarksAgainst(held.worktree.path, patches)
      this.commit(withRemarks(withContext(this.state, next, patches, cursor), remarks))
    })
  }

  private remember(action: Action | undefined, key: KeyEvent): void {
    if (takesText(this.state.screen) && action === undefined) return
    const named = action ?? keyName(key)
    this.keys.push(named)
    if (this.keys.length > KEY_HISTORY) this.keys.shift()
    this.trail.push(momentOf(named, this.state, this.since()))
    if (this.trail.length > TRAIL_HISTORY) this.trail.shift()
  }

  private sendReport(): Work {
    return Effect.gen({ self: this }, function* () {
      if (this.state.draft.trim().length === 0) {
        this.commit(withNotice(this.state, "say what went wrong first"))
        return
      }
      const text = buildReport(this.state, {
        repo: this.repo,
        base: this.base ?? "",
        slowest: this.slowest(),
        keys: this.keys,
        trail: this.trail,
        failure: this.failure,
        failureKind: this.failureKind,
        width: this.renderer.width,
        height: this.renderer.height,
      })
      const stamp = new Date().toISOString().replace(/[:.]/g, "-")
      const path = yield* (saveReport(stamp, text))
      copyToClipboard(text)
      const closed = { ...this.state, screen: this.state.returnTo, draft: "" }
      this.commit(withNotice(closed, `report copied — ${path}`))
    })
  }

  private send(): Work {
    if (this.state.answerTo !== undefined) return this.sendRemarkAnswer(this.state.answerTo)
    return this.state.replyTo === undefined ? this.sendComment() : this.sendReply(this.state.replyTo)
  }

  private sendReply(to: string): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      if (branch === undefined) return
      if (this.state.draft.trim().length === 0) {
        this.commit(withNotice(this.state, NOTHING_WRITTEN))
        return
      }
      yield* submitReply({
        repo: this.repo,
        branch: branch.branch,
        to,
        body: yield* this.display.written,
        id: randomUUID(),
        at: new Date().toISOString(),
      })
      const sent = yield* this.loadSent(branch.branch)
      this.commit(withNotice(sentAway(withSent(this.state, sent)), "sent to the agent"))
    })
  }

  private askForLayers(): Work {
    return Effect.gen({ self: this }, function* () {
      const patch = this.state.patches[0]
      const branch = selectedBranch(this.state)
      if (patch === undefined || branch === undefined) return
      yield* this.commenting(branch.branch, {
        repo: this.repo,
        branch: branch.branch,
        file: patch.path,
        side: "new",
        start: 1,
        end: 1,
        body: layersAsk(this.state),
        id: randomUUID(),
        at: new Date().toISOString(),
      })
      const sent = yield* this.loadSent(branch.branch)
      this.commit(withNotice(withSent(this.state, sent), askedFor(this.state)))
    })
  }

  private sendComment(): Work {
    return Effect.gen({ self: this }, function* () {
      const patch = selectedPatch(this.state)
      const branch = selectedBranch(this.state)
      const [from, to] = selectionRange(this.state)
      if (patch === undefined || branch === undefined) return
      if (this.state.draft.trim().length === 0) {
        this.commit(withNotice(this.state, NOTHING_WRITTEN))
        return
      }
      const anchor = anchorFor(patch, from, to)
      if (Option.isNone(anchor)) {
        this.commit(withNotice(this.state, "nothing selected"))
        return
      }
      const body = yield* this.display.written
      if (this.state.hold) {
        this.holding({
          file: patch.path,
          side: anchor.value.side,
          start: anchor.value.start,
          end: anchor.value.end,
          body,
        })
        return
      }
      yield* this.commenting(branch.branch, {
        repo: this.repo,
        branch: branch.branch,
        file: patch.path,
        side: anchor.value.side,
        start: anchor.value.start,
        end: anchor.value.end,
        body,
        id: randomUUID(),
        at: new Date().toISOString(),
      })
      const sent = yield* this.loadSent(branch.branch)
      this.commit(withNotice(sentAway(withSent(this.state, sent)), "sent to the agent"))
    })
  }

  private holding(comment: StagedComment): void {
    const held = [...this.state.held, comment]
    this.commit(
      withNotice(
        sentAway({ ...this.state, held }),
        `held — ${countOf(held.length, "comment")} waiting, press C to send`,
      ),
    )
  }

  private dropHeld(at: number): Work {
    return Effect.sync(() => {
      const was = this.state.panelIndex
      const held = this.state.held.filter((_, index) => index !== at)
      this.commit(withNotice(this.staying({ ...this.state, held }, was), "dropped, it was never sent"))
    })
  }

  private sendHeld(): Work {
    return Effect.gen({ self: this }, function* () {
      const branch = selectedBranch(this.state)
      const [first, ...rest] = this.state.held
      if (branch === undefined || first === undefined) return
      const at = new Date().toISOString()
      const asked = (comment: StagedComment): CommentRequest => ({
        repo: this.repo,
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
      const many = this.state.held.length
      yield* this.sending(branch.branch, [asked(first), ...rest.map(asked)])
      const sent = yield* this.loadSent(branch.branch)
      this.commit(
        withNotice(
          withSent({ ...this.state, held: [] }, sent),
          `sent ${countOf(many, "comment")} to the agent`,
        ),
      )
    })
  }
}

const sentAway = (state: TuiState): TuiState => ({
  ...state,
  screen: "review",
  draft: "",
  draftAt: "",
  replyTo: undefined,
})

const turnedOver = (state: TuiState): TuiState => ({
  ...state,
  picked: undefined,
  railScroll: -1,
  scroll: -1,
  selecting: false,
  anchorRow: state.cursor,
})

const settledPath = (path: string): Effect.Effect<string> =>
  Effect.promise(() => realpath(path).catch(() => resolve(path)))

const restsWhereItLanded = (from: Spot, to: Spot): boolean =>
  from.row === to.row && from.column === to.column

const lonelyGaps = (state: TuiState): ReadonlyArray<{ index: number; hidden: number }> =>
  (shownOf(state)?.gaps ?? []).filter((gap) => gap.hidden === 1)

const chosenIn = (state: TuiState): Readonly<Record<string, boolean>> => ({
  wrap: state.wrap,
  sticky: state.sticky,
  panel: state.panelOpen,
  hideReviewed: state.hideReviewed,
  hideSettled: state.hideSettled,
  newestFirst: state.newestFirst,
  remarks: state.remarksOn,
  hold: state.hold,
})

const settingsHeld = Effect.gen(function* () {
  const store = yield* Store
  const kept = heldValues(yield* store.settings)
  return {
    wrap: kept["wrap"] === true,
    sticky: kept["sticky"] === true,
    panelOpen: kept["panel"] === true,
    panelWas: kept["panel"] === true,
    hideReviewed: kept["hideReviewed"] === true,
    hideSettled: kept["hideSettled"] === true,
    newestFirst: kept["newestFirst"] === true,
    remarksOn: kept["remarks"] === true,
    hold: kept["hold"] === true,
  }
})

const firstBranches = Effect.fn("Tui.firstBranches")(function* (
  repo: string,
  branch: string | undefined,
  base: string | undefined,
) {
  if (branch === undefined) return yield* listBranches(repo, base)
  const only = yield* summaryFor(repo, branch, base).pipe(Effect.orElseSucceed(() => undefined))
  return only === undefined ? yield* listBranches(repo, base) : [only]
})

const missing = (branch: string | undefined, found: Option.Option<number>): string =>
  branch !== undefined && Option.isNone(found) ? `no branch here is called ${branch}` : ""

const openingOn = (
  branches: ReadonlyArray<BranchSummary>,
  branch: string | undefined,
): Option.Option<number> => {
  if (branch === undefined) return Option.none()
  const at = branches.findIndex((candidate) => candidate.branch === branch)
  return at === -1 ? Option.none() : Option.some(at)
}

export type LaunchOptions = {
  readonly noticeMs?: number | undefined
  readonly sessionPath?: string | undefined
  readonly branch?: string | undefined
  readonly base?: string | undefined
}

export const launch = Effect.fn("Tui.launch")(function* (
  asked: string,
  renderer: CliRenderer,
  options: LaunchOptions = {},
) {
  const { noticeMs, sessionPath } = options
  const repo = yield* settledPath(asked)
  const branches = yield* firstBranches(repo, options.branch, options.base)
  const asOpened = openingOn(branches, options.branch)
  const missed = missing(options.branch, asOpened)
  const resume = Option.isSome(asOpened)
    ? Option.none<Session>()
    : sessionPath === undefined
      ? Option.none<Session>()
      : yield* readSession(sessionPath)
  const store = yield* Store
  const kept = yield* settingsHeld
  const display = yield* Display.pipe(Effect.provide(displayOn(renderer, repo)))
  const waiting = yield* upgradeHint
  const state = yield* SubscriptionRef.make({
    ...initialState(branches),
    ...kept,
    waiting,
    notice: missed,
  })
  const painting = yield* Effect.forkDetach(
    Stream.runForEach(SubscriptionRef.changes(state), display.paint),
  )
  const partial = options.branch !== undefined && branches.length === 1
  const intents = yield* Queue.unbounded<Intent>()
  const app = new App({
    renderer,
    repo,
    base: options.base,
    display,
    state,
    painting,
    noticeMs,
    sessionPath,
    resume: Option.getOrUndefined(resume),
    opensOn: Option.getOrUndefined(asOpened),
    chosen: kept,
    partial,
    intents,
  })
  app.watch(yield* Effect.forkDetach(app.consume()))
  const noticing = Stream.runForEach(answers(store.root), () => told(app))
  app.listen(yield* Effect.forkDetach(noticing))
  return app
})

const told = (app: App): Effect.Effect<void> => Effect.sync(() => app.answered())

const untilDestroyed = (renderer: CliRenderer): Effect.Effect<void> =>
  Effect.callback<void>((resume) => {
    renderer.on("destroy", () => resume(Effect.void))
  })

export const runOn = Effect.fn("Tui.runOn")(function* (
  repo: string,
  renderer: CliRenderer,
  options: LaunchOptions = {},
) {
  yield* launch(repo, renderer, options)
  yield* untilDestroyed(renderer)
})

export const runTui = Effect.fn("Tui.run")(function* (
  repo: string,
  options: LaunchOptions = {},
) {
  const renderer = yield* Effect.promise(() =>
    createCliRenderer({
      exitOnCtrlC: false,
      useKittyKeyboard: { events: true, allKeysAsEscapes: true },
    }),
  )
  yield* Effect.ensuring(
    runOn(repo, renderer, options),
    Effect.sync(() => renderer.destroy()),
  )
})

export type { Action }
