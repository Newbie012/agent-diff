import {
  createCliRenderer,
  getTreeSitterClient,
  stripAnsiSequences,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core"
import {
  Cause,
  Deferred,
  Effect,
  FiberHandle,
  Option,
  Queue,
  Schedule,
  Stream,
  SubscriptionRef,
  type Fiber,
} from "effect"
import {
  listBranches,
  summaryFor,
  savePreference,
  type BranchReading,
  type BranchSummary,
} from "../review/index.ts"
import { heldValues } from "../domain/preferences/index.ts"
import { Git } from "../service/git/index.ts"
import { Store } from "../service/store/index.ts"
import { answers } from "./watch.ts"
import { actionFor, takesText, type Action } from "./command.ts"
import { keyName, keyNamed, listens, overReview, writesInto } from "./keys.ts"
import {
  draggedTo,
  paletteChoice,
  paletteClosed,
  paletteMoved,
  panBy,
  pickedIn,
  reduce,
  restingOn,
  scrolled,
  legible,
  withColumns,
  withDraft,
  withNotice,
  withNoticeHere,
} from "./reduce.ts"
import type { Needs, Work } from "./needs.ts"
import { Intent } from "./intent.ts"
import { Screen } from "./render.ts"
import { readSession, sessionOf, writeSession, type Session } from "./session.ts"
import { upgradeHint } from "./upgrade.ts"
import type { Aside, Diagnostics, Terminal, Timing } from "./terminal.ts"
import {
  clearBaseHere,
  fillBranches,
  goBack,
  loadPulls,
  noticeAnswers,
  openBases,
  openBranch,
  openedOn,
  reloadBranch,
  reloadList,
  resumeAt,
  setBaseHere,
  showPull,
} from "./branches.ts"
import { askForLayers, compose, replyHere, send, sendHeld } from "./comments.ts"
import { chooseEditor, editorChosen, forgetEditor, openInEditor } from "./editor.ts"
import { clicked, commitSynced, moveFile, rolled, stepped, walkComments } from "./moving.ts"
import { acceptRemarkHere } from "./remarks.ts"
import { sendReport } from "./reporting.ts"
import {
  LEAST_TERM,
  findSelection,
  forgetMatches,
  lookFor,
  runFinder,
  walkMatches,
} from "./search.ts"
import { copyDragged, copySelection } from "./selection.ts"
import { expand, unfold, widen } from "./source.ts"
import { removeHere, settleHere, settleWhatIsRead } from "./threads.ts"
import { tookTheAnswer, vouch } from "./vouching.ts"
import { contextToggled } from "./files.ts"
import { initialState, onLayers, selectedPatch, type Spot, type TuiState } from "./state.ts"
import { counted } from "./words.ts"

const LEAVING_MS = 3000
const LOOK_MS = 260
const AGE_TICK_MS = 30_000
const NOTICE_MS = 2200
const WORTH_TIMING_MS = 250
const TIMES_KEPT = 40
const SLOWEST_KEPT = 3
const KEY_HISTORY = 40
const TRAIL_HISTORY = 20
const DRAIN_PASSES = 8

const LEAVING_SAID = "press ctrl+c again to leave"

const leavingSaid = (state: TuiState): string =>
  state.held.length === 0
    ? LEAVING_SAID
    : `${counted(state.held.length, "comment")} never sent — press ctrl+c again to leave without them`

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

const turnedOver = (state: TuiState): TuiState => ({
  ...state,
  picked: undefined,
  railScroll: -1,
  scroll: -1,
  selecting: false,
  anchorRow: state.cursor,
})

const unmoved = (from: Spot, to: Spot): boolean =>
  from.row === to.row && from.column === to.column

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

type Asides = {
  readonly sourcing: Aside
  readonly fetching: Aside
  readonly searching: Aside
  readonly lighting: Aside
  readonly looking: Aside
  readonly fading: Aside
}

type RunAside = (effect: Effect.Effect<void>) => Fiber.Fiber<void>

export type AppOptions = {
  readonly renderer: CliRenderer
  readonly screen: Screen
  readonly repo: string
  readonly base: string | undefined
  readonly state: SubscriptionRef.SubscriptionRef<TuiState>
  readonly intents: Queue.Queue<Intent>
  readonly asides: Asides
  readonly runFading: RunAside
  readonly runLooking: RunAside
  readonly noticeMs: number
  readonly sessionPath: string | undefined
  readonly chosen: Partial<TuiState>
}

type Effects = Readonly<Partial<Record<Action, (app: App) => Work>>>

const EFFECTS: Effects = {
  quit: (app) => Effect.sync(() => app.renderer.destroy()),
  "branch.open": openBranch,
  "branch.pull": showPull,
  "compose.open": compose,
  "compose.submit": send,
  "held.send": sendHeld,
  "palette.run": (app) => app.runChoice(),
  "comment.next": (app) => walkComments(app, 1),
  "comment.prev": (app) => walkComments(app, -1),
  "file.next": (app) => moveFile(app, 1),
  "file.prev": (app) => moveFile(app, -1),
  "cursor.next": (app) => stepped(app, 1),
  "cursor.prev": (app) => stepped(app, -1),
  "rail.toggle": (app) => commitSynced(app, "rail.toggle"),
  "layers.ask": askForLayers,
  "file.vouch": (app) => vouch(app, false),
  "file.vouch.next": (app) => vouch(app, true),
  "ask.take": tookTheAnswer,
  "thread.settle": settleHere,
  "thread.settleRead": settleWhatIsRead,
  "thread.remove": removeHere,
  "thread.reply": replyHere,
  "remark.accept": acceptRemarkHere,
  "selection.copy": (app) => Effect.sync(() => copySelection(app, false)),
  "search.open": findSelection,
  "search.jump": runFinder,
  "review.reload": (app) => (app.state.screen === "branches" ? reloadList(app) : reloadBranch(app)),
  "base.open": openBases,
  "base.set": (app) => (app.state.screen === "editor" ? editorChosen(app) : setBaseHere(app)),
  "base.clear": (app) => (app.state.screen === "editor" ? forgetEditor(app) : clearBaseHere(app)),
  "line.open": openInEditor,
  "editor.open": chooseEditor,
  back: goBack,
  "report.send": sendReport,
  "context.more": (app) => expand(app, 1),
  "context.less": (app) => expand(app, -1),
  "context.whole": (app) => widen(app, contextToggled(app.state)),
  "tree.expand": (app) => unfold(app, 1),
  "tree.collapse": (app) => unfold(app, -1),
  "match.next": (app) => walkMatches(app, 1),
  "match.prev": (app) => walkMatches(app, -1),
}

export class App implements Terminal {
  readonly renderer: CliRenderer
  readonly screen: Screen
  readonly repo: string
  readonly base: string | undefined
  readonly sourcing: Aside
  readonly fetching: Aside
  readonly searching: Aside
  readonly lighting: Aside
  readonly looking: Aside
  reading: BranchReading | undefined

  private readonly held: SubscriptionRef.SubscriptionRef<TuiState>
  private readonly intents: Queue.Queue<Intent>
  private readonly runFading: RunAside
  private readonly runLooking: RunAside
  private readonly noticeMs: number
  private readonly sessionPath: string | undefined
  private readonly chosen: Record<string, boolean> = {}
  private readonly began = Date.now()
  private readonly keys: Array<string> = []
  private readonly trail: Array<string> = []
  private readonly took: Array<Timing> = []
  private failure = ""
  private failureKind = ""
  private roomed = 0
  private remembered = ""
  private selectingNow = false
  private leaving: number | undefined
  private rolling = false
  private pendingRoll = 0
  private grewWithShift = false
  private wheel = 0
  private sideways = 0

  constructor(options: AppOptions) {
    this.renderer = options.renderer
    this.screen = options.screen
    this.repo = options.repo
    this.base = options.base
    this.held = options.state
    this.intents = options.intents
    this.sourcing = options.asides.sourcing
    this.fetching = options.asides.fetching
    this.searching = options.asides.searching
    this.lighting = options.asides.lighting
    this.looking = options.asides.looking
    this.runFading = options.runFading
    this.runLooking = options.runLooking
    this.noticeMs = options.noticeMs
    this.sessionPath = options.sessionPath
    Object.assign(this.chosen, chosenIn({ ...initialState([]), ...options.chosen }))
    this.wire()
  }

  private wire(): void {
    const { renderer, screen } = this
    screen.listen({
      onClick: (what) => this.dispatch(clicked(this, what)),
      onScroll: (delta) => this.onWheel(delta),
      onPan: (delta) => this.onPanWheel(delta),
      onDrag: (from, to, done) => this.dragged(from, to, done),
      onChip: (key) => this.dispatch(this.onKey(keyNamed(key))),
      onRail: (delta) => this.rollFrom(delta),
    })
    screen.onWritten((text) => this.readBack(text))
    screen.onAsked((text) => this.askedBack(text))
    renderer.on("selection", () => copyDragged(this))
    renderer.keyInput.on("keypress", (key) => this.pressed(key))
    renderer.keyInput.on("keyrelease", (key) => this.letGo(key))
    renderer.on("frame", () => this.syncGeometry())
    renderer.on("resize", () => this.resized())
    renderer.setFrameCallback(() => Promise.resolve(this.applyWheel()))
  }

  open(opensOn: Option.Option<number>, session: Option.Option<Session>, partial: boolean): void {
    this.commit({ ...this.state, now: Date.now() })
    if (Option.isSome(opensOn)) this.dispatch(openedOn(this, opensOn.value))
    else if (Option.isSome(session)) this.dispatch(resumeAt(this, session.value))
    this.dispatch(loadPulls(this))
    if (partial) this.dispatch(fillBranches(this))
  }

  answered(): void {
    this.dispatch(noticeAnswers(this))
  }

  ticked(): void {
    this.commit({ ...this.state, now: Date.now() })
  }

  dispatch(task: Work): void {
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

  private answer(intent: Intent): Work {
    return Intent.$match(intent, {
      Key: ({ key }) => this.onKey(key),
      Task: ({ run }) => run,
      Ping: ({ done }) => Effect.asVoid(Deferred.succeed(done, undefined)),
    })
  }

  private timed(began: number): void {
    const ms = Date.now() - began
    if (ms < WORTH_TIMING_MS) return
    this.took.push({ action: this.trail.at(-1)?.trim().split(/\s+/)[1] ?? "a key", ms })
    if (this.took.length > TIMES_KEPT) this.took.shift()
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

  diagnostics(): Diagnostics {
    return {
      slowest: [...this.took].toSorted((left, right) => right.ms - left.ms).slice(0, SLOWEST_KEPT),
      keys: this.keys,
      trail: this.trail,
      failure: this.failure,
      failureKind: this.failureKind,
    }
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
    const asides = [this.sourcing, this.fetching, this.searching, this.lighting]
    return Effect.runPromise(
      Effect.gen({ self: this }, function* () {
        yield* this.drained()
        for (const aside of asides) yield* FiberHandle.awaitEmpty(aside)
      }),
    )
  }

  get state(): TuiState {
    return SubscriptionRef.getUnsafe(this.held)
  }

  write(next: TuiState): void {
    Effect.runSync(SubscriptionRef.set(this.held, next))
  }

  measured(): TuiState {
    return { ...this.state, viewport: this.screen.viewportRows() }
  }

  standing(): TuiState {
    const held = this.measured()
    return held.scroll >= 0 ? held : { ...held, scroll: this.screen.scrolledAt() }
  }

  commit(given: TuiState): void {
    const kept = this.keptScroll(given)
    const next = kept.patchIndex === this.state.patchIndex ? kept : turnedOver(kept)
    this.turnWriting(next)
    const appeared = next.notice.length > 0 && next.notice !== this.state.notice
    if (appeared) this.recordNotice(next.notice)
    this.rememberPlace(next)
    this.rememberChosen(next)
    this.write(next)
    if (appeared) this.fade()
  }

  private keptScroll(given: TuiState): TuiState {
    if (this.state.screen !== "compose" || given.screen === "compose") return given
    if (given.patchIndex !== this.state.patchIndex) return given
    return { ...given, scroll: this.screen.scrolledAt() }
  }

  private recordNotice(notice: string): void {
    this.trail.push(noticeOf(notice, this.since()))
    if (this.trail.length > TRAIL_HISTORY) this.trail.shift()
  }

  private since(): number {
    return Date.now() - this.began
  }

  private rememberChosen(next: TuiState): void {
    for (const [name, value] of Object.entries(chosenIn(next))) {
      if (this.chosen[name] === value) continue
      this.chosen[name] = value
      this.dispatch(Effect.ignore(savePreference(name, value)))
    }
  }

  private rememberPlace(next: TuiState): void {
    if (this.sessionPath === undefined || next.screen !== "review") return
    const session = sessionOf(next)
    const line = JSON.stringify(session)
    if (line === this.remembered) return
    this.remembered = line
    this.dispatch(writeSession(this.sessionPath, session))
  }

  private fade(): void {
    const clearing = Effect.gen({ self: this }, function* () {
      yield* Effect.sleep(this.noticeMs)
      if (this.state.notice.length > 0) this.commit({ ...this.state, notice: "" })
    })
    this.runFading(clearing)
  }

  private turnWriting(next: TuiState): void {
    if (listens(next.screen) !== listens(this.state.screen) || next.screen !== this.state.screen) {
      this.screen.askOn(listens(next.screen) ? next.screen : undefined)
    }
    const was = writesInto(this.state.screen)
    const now = writesInto(next.screen)
    if (was === now) {
      if (now && next.draftAt !== this.state.draftAt) this.screen.write(next.draft)
      return
    }
    if (now) this.screen.write(next.draft)
    this.screen.writeOn(now)
  }

  private askedBack(text: string): void {
    const clean = legible(text).replaceAll("\n", " ")
    if (clean !== text) {
      this.screen.askWith(clean)
      return
    }
    if (!listens(this.state.screen) || clean === this.state.query) return
    this.commit({ ...this.state, query: clean, paletteIndex: 0, refIndex: 0 })
    if (this.state.screen === "search") this.lookSoon(clean)
  }

  private readBack(text: string): void {
    const clean = legible(stripAnsiSequences(text))
    if (clean !== text) {
      this.screen.write(clean)
      return
    }
    if (text === this.state.draft) return
    this.commit(withDraft(this.state, text))
  }

  private lookSoon(wanted: string): void {
    const looking = Effect.gen({ self: this }, function* () {
      yield* Effect.sleep(LOOK_MS)
      const asked = wanted.trim()
      if (this.state.screen !== "search" || this.state.query.trim() !== asked) return
      this.dispatch(asked.length < LEAST_TERM ? forgetMatches(this) : this.searchAside(asked))
    })
    this.runLooking(looking)
  }

  private searchAside(wanted: string): Work {
    return this.aside(this.searching, lookFor(this, wanted))
  }

  aside(handle: Aside, work: Work): Effect.Effect<void, never, Needs> {
    const quiet = work.pipe(Effect.catchCause((cause) => Effect.sync(() => this.fail(Cause.squash(cause)))))
    return Effect.asVoid(FiberHandle.run(handle)(quiet))
  }

  private pressed(key: KeyEvent): void {
    if (this.renderer.hasSelection) this.renderer.clearSelection()
    Queue.offerUnsafe(this.intents, Intent.Key({ key }))
  }

  private letGo(key: KeyEvent): void {
    if (!key.name.endsWith("shift") || !this.grewWithShift) return
    this.grewWithShift = false
    Queue.offerUnsafe(this.intents, Intent.Key({ key: keyNamed("c") }))
  }

  private onKey(key: KeyEvent, forced?: Action): Work {
    return Effect.gen({ self: this }, function* () {
      if (forced === undefined && keyName(key) === "ctrl+c") {
        this.askedToLeave()
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
      const effect = EFFECTS[action]
      if (effect === undefined) {
        this.commit(reduce(this.measured(), action))
        return
      }
      yield* effect(this)
    })
  }

  private onText(key: KeyEvent): void {
    if (!listens(this.state.screen)) return
    if (key.name === "down" || key.name === "up") {
      this.commit(paletteMoved(this.state, key.name === "down" ? 1 : -1))
    }
  }

  private remember(action: Action | undefined, key: KeyEvent): void {
    if (takesText(this.state.screen) && action === undefined) return
    const named = action ?? keyName(key)
    this.keys.push(named)
    if (this.keys.length > KEY_HISTORY) this.keys.shift()
    this.trail.push(momentOf(named, this.state, this.since()))
    if (this.trail.length > TRAIL_HISTORY) this.trail.shift()
  }

  runChoice(): Work {
    return Effect.gen({ self: this }, function* () {
      const chosen = paletteChoice(this.state)
      const closed = paletteClosed(this.state)
      if (chosen === undefined) {
        this.commit(closed)
        return
      }
      this.write(closed)
      yield* this.onKey(keyNamed(""), chosen)
    })
  }

  private forgetLeaving(): void {
    if (this.leaving === undefined) return
    this.leaving = undefined
    if (this.state.notice === leavingSaid(this.state)) this.commit(withNoticeHere(this.state, ""))
  }

  private askedToLeave(): void {
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
  }

  private dragged(from: Spot, to: Spot, done: boolean): void {
    const held = { ...this.measured(), focus: "diff" as const }
    if (unmoved(from, to) && !this.selectingNow) {
      this.commit(restingOn(held, from.row))
      return
    }
    const along = from.row === to.row
    this.selectingNow = !done
    this.commit(
      along ? pickedIn(held, from.row, from.column, to.column) : draggedTo(held, from.row, to.row),
    )
    if (done) copySelection(this, true)
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
    if (listens(this.state.screen)) {
      if (down !== 0) this.commit(paletteMoved(this.state, down))
      return
    }
    const moved = down === 0 ? this.measured() : scrolled(this.standing(), down)
    this.commit(across === 0 ? moved : panBy(moved, across))
  }

  private rollFrom(delta: number): void {
    if (!onLayers(this.state)) {
      this.dispatch(rolled(this, delta))
      return
    }
    if (this.rolling) {
      this.pendingRoll = delta
      return
    }
    this.rolling = true
    this.dispatch(rolled(this, delta).pipe(Effect.ensuring(Effect.sync(() => this.rolledOn()))))
  }

  private rolledOn(): void {
    this.rolling = false
    const held = this.pendingRoll
    this.pendingRoll = 0
    if (held !== 0) this.rollFrom(held > 0 ? 1 : -1)
  }

  private resized(): void {
    this.screen.update(this.state)
    this.syncGeometry()
  }

  private syncGeometry(): void {
    const rows = this.screen.viewportRows()
    if (rows !== this.state.viewport) {
      this.commit({ ...this.state, viewport: rows })
      return
    }
    const columns = this.screen.columns()
    if (columns !== this.state.columns) {
      this.commit(withColumns(this.state, columns))
      return
    }
    const tallest = this.screen.tallestRows()
    if (tallest !== this.state.tallest) {
      this.commit({ ...this.state, tallest })
      return
    }
    const railRows = this.screen.railRows()
    if (railRows !== this.state.railRows) {
      this.commit({ ...this.state, railRows })
      return
    }
    const room = this.screen.noteRoom()
    if (room === this.roomed) return
    this.roomed = room
    this.screen.update(this.state)
  }
}

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
  const only = yield* Effect.option(summaryFor(repo, branch, base))
  return Option.isNone(only) ? yield* listBranches(repo, base) : [only.value]
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

const sessionToResume = (
  opensOn: Option.Option<number>,
  sessionPath: string | undefined,
): Effect.Effect<Option.Option<Session>> =>
  Option.isSome(opensOn) || sessionPath === undefined
    ? Effect.succeed(Option.none())
    : readSession(sessionPath)

const asidesMade = Effect.gen(function* () {
  return {
    sourcing: yield* FiberHandle.make<void, never>(),
    fetching: yield* FiberHandle.make<void, never>(),
    searching: yield* FiberHandle.make<void, never>(),
    lighting: yield* FiberHandle.make<void, never>(),
    looking: yield* FiberHandle.make<void, never>(),
    fading: yield* FiberHandle.make<void, never>(),
  }
})

const treeSitterFreed = Effect.addFinalizer(() => Effect.promise(() => getTreeSitterClient().destroy()))

const shownOn =
  (screen: Screen) =>
  (shown: TuiState): Effect.Effect<void> =>
    Effect.sync(() => screen.update(shown))

const painting = (screen: Screen, state: SubscriptionRef.SubscriptionRef<TuiState>): Effect.Effect<void> =>
  Stream.runForEach(SubscriptionRef.changes(state), shownOn(screen))

const ticking = (app: App): Effect.Effect<number> =>
  Effect.repeat(Effect.sync(() => app.ticked()), Schedule.spaced(AGE_TICK_MS))

const noticing = (app: App, root: string): Effect.Effect<void> =>
  Stream.runForEach(answers(root), () => Effect.sync(() => app.answered()))

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
  const git = yield* Git
  const repo = yield* git.realPathOf(asked)
  const branches = yield* firstBranches(repo, options.branch, options.base)
  const opensOn = openingOn(branches, options.branch)
  const session = yield* sessionToResume(opensOn, options.sessionPath)
  const store = yield* Store
  const chosen = yield* settingsHeld
  const waiting = yield* upgradeHint
  const state = yield* SubscriptionRef.make({
    ...initialState(branches),
    ...chosen,
    waiting,
    notice: missing(options.branch, opensOn),
  })
  const screen = new Screen(renderer, repo)
  yield* Effect.forkScoped(painting(screen, state))
  const asides = yield* asidesMade
  const runFading = yield* FiberHandle.runtime(asides.fading)()
  const runLooking = yield* FiberHandle.runtime(asides.looking)()
  const app = new App({
    renderer,
    screen,
    repo,
    base: options.base,
    state,
    intents: yield* Queue.unbounded<Intent>(),
    asides,
    runFading,
    runLooking,
    noticeMs: options.noticeMs ?? NOTICE_MS,
    sessionPath: options.sessionPath,
    chosen,
  })
  yield* Effect.forkScoped(app.consume())
  yield* Effect.forkScoped(ticking(app))
  yield* Effect.forkScoped(noticing(app, store.root))
  yield* treeSitterFreed
  app.open(opensOn, session, options.branch !== undefined && branches.length === 1)
  return app
})

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
}, Effect.scoped)

const rendererMade = Effect.acquireRelease(
  Effect.promise(() =>
    createCliRenderer({
      exitOnCtrlC: false,
      useKittyKeyboard: { events: true, allKeysAsEscapes: true },
    }),
  ),
  (made) => Effect.sync(() => made.destroy()),
)

export const runTui = Effect.fn("Tui.run")(function* (
  repo: string,
  options: LaunchOptions = {},
) {
  const renderer = yield* rendererMade
  yield* runOn(repo, renderer, options)
}, Effect.scoped)

export type { Action }
