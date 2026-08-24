import { CodeRenderable, Renderable } from "@opentui/core"
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { Effect, Exit, Layer, Scope } from "effect"
import { Git, GitLive } from "../../../service/git/index.ts"
import { Forge, ForgeLive } from "../../../service/forge/index.ts"
import { storeAt } from "../../../service/store/index.ts"
import { launch, palette } from "../../../tui/index.ts"
import type { App, TuiState } from "../../../tui/index.ts"
import { series, type DriverState } from "../../state.ts"

const NAMED: Readonly<Record<string, string>> = {
  up: "ARROW_UP",
  down: "ARROW_DOWN",
  left: "ARROW_LEFT",
  right: "ARROW_RIGHT",
  tab: "TAB",
  return: "RETURN",
  escape: "ESCAPE",
  backspace: "BACKSPACE",
  home: "HOME",
  end: "END",
  space: " ",
  pageup: "\u001B[5~",
  pagedown: "\u001B[6~",
}

const sendable = (key: string): string => NAMED[key] ?? key

const WHERE: Readonly<Record<string, string>> = {
  tree: "file list",
  diff: "diff",
  review: "review panel",
}

const panesIn = (state: TuiState | undefined): ReadonlyArray<string> => [
  ...(state?.navOpen === true ? ["file list"] : []),
  "diff",
  ...(state?.panelOpen === true ? ["review panel"] : []),
]

const whereIn = (state: TuiState | undefined): string => WHERE[state?.focus ?? "diff"] ?? "diff"

const believedIn = (state: TuiState | undefined) => ({
  focus: whereIn(state),
  panes: panesIn(state),
  scroll: state?.scroll ?? -1,
  cursor: state?.cursor ?? -1,
  wrap: state?.wrap === true,
  sticky: state?.sticky === true,
  hold: state?.hold === true,
})

const watchedForge = (note: () => void): Layer.Layer<Forge> =>
  Layer.succeed(Forge)({
    pulls: () =>
      Effect.sync(() => {
        note()
        return []
      }),
    openPull: () => Effect.void,
    head: () => Effect.succeed(""),
    review: () => Effect.succeed({ landed: [], url: "" }),
    remarks: () => Effect.succeed([]),
    answer: () => Effect.void,
  })

const CLIP = /\u005d52;c;([A-Za-z0-9+/=]*)/g

const hex = (value: number): string => value.toString(16).padStart(2, "0")

const fgOf = (span: Span): string =>
  `#${hex(Math.round(span.fg.r * 255))}${hex(Math.round(span.fg.g * 255))}${hex(Math.round(span.fg.b * 255))}`

const bgOf = (span: Span): string =>
  `#${hex(Math.round(span.bg.r * 255))}${hex(Math.round(span.bg.g * 255))}${hex(Math.round(span.bg.b * 255))}`

export type Wheel = "up" | "down" | "left" | "right"

const PUMP_MS = 4
const PUMP_ATTEMPTS = 250
const PUMP_LONG = 700
const REST_PASSES = 4
const HIGHLIGHT_LINES = 40
const HIGHLIGHTED: ReadonlyArray<string> = ["diff-code", "diff-pin"]
const LAYOUT_ATTEMPTS = 30

type Span = { readonly fg: Channels; readonly bg: Channels }

type Channels = { r: number; g: number; b: number }
const NOTICE_MS = 900
const WIDTH = 120
const HEIGHT = 32

export type OpenOptions = {
  readonly width?: number
  readonly height?: number
  readonly repo?: string
  readonly upgrades?: boolean
  readonly branch?: string
  readonly base?: string
  readonly review?: boolean
  readonly forgeWatched?: boolean
  readonly noticeMs?: number
  readonly slowGrepMs?: number
  readonly slowFirstGrepMs?: number
}

export class ScreenTestDriver {
  private setup: TestRendererSetup | undefined
  private scope: Scope.Closeable | undefined
  private app: App | undefined
  private diffs = 0
  private greps = 0
  private slowGrepMs = 0
  private slowFirstGrepMs = 0
  private readonly order: Array<string> = []
  private readonly crashes: Array<string> = []
  private watching: ((cause: unknown) => void) | undefined
  private keysSeen = 0
  private written: Array<string> = []
  private wrote: typeof process.stdout.write | undefined
  private counting: (() => void) | undefined

  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  private noteSeat(options: OpenOptions): void {
    this.state.tracer.sawSeat({ width: options.width ?? WIDTH, height: options.height ?? HEIGHT })
  }

  private checkUpgrades(options: OpenOptions): void {
    if (options.upgrades === true) delete process.env["ADIFF_NO_UPGRADE_CHECK"]
    else process.env["ADIFF_NO_UPGRADE_CHECK"] = "1"
  }

  private forgeFor(options: OpenOptions): Layer.Layer<Forge> {
    return options.forgeWatched === true
      ? watchedForge(() => this.order.push("forge"))
      : ForgeLive
  }

  async open(options: OpenOptions = {}): Promise<void> {
    this.noteSeat(options)
    this.watchClipboard()
    this.checkUpgrades(options)
    const setup = await createTestRenderer({
      width: options.width ?? WIDTH,
      height: options.height ?? HEIGHT,
      exitOnCtrlC: false,
    })
    this.setup = setup
    this.slowedBy(options)
    this.watch()
    this.countKeys(setup)
    const layer = Layer.mergeAll(
      this.countingGit(),
      this.forgeFor(options),
      storeAt(this.state.storeRoot),
    )
    const scope = Scope.makeUnsafe()
    this.scope = scope
    const context = await Effect.runPromise(Layer.buildWithScope(layer, scope))
    this.app = await Effect.runPromise(
      launch(options.repo ?? this.state.repo, setup.renderer, {
        noticeMs: options.noticeMs ?? NOTICE_MS,
        sessionPath: this.state.sessionPath,
        branch: options.branch,
        base: options.base,
      }).pipe(
        Effect.provideContext(context),
      ),
    )
    await this.app.settled()
    await setup.waitForVisualIdle()
    if (options.review === true) await this.pressKeys(["RETURN"])
  }

  async restart(options: OpenOptions = {}): Promise<void> {
    this.state.tracer.cannotReplay("a restart")
    await this.close()
    await this.open(options)
  }

  private watch(): void {
    const record = (cause: unknown): void => {
      const message = cause instanceof Error ? cause.message : String(cause)
      this.crashes.push(message)
    }
    this.watching = record
    process.on("uncaughtException", record)
    process.on("unhandledRejection", record)
  }

  private slowedBy(options: OpenOptions): void {
    this.slowGrepMs = options.slowGrepMs ?? 0
    this.slowFirstGrepMs = options.slowFirstGrepMs ?? 0
  }

  private countingGit(): Layer.Layer<Git> {
    return Layer.effect(Git)(
      Effect.gen({ self: this }, function* () {
        const git = yield* Git
        return {
          ...git,
          diff: (worktree, context, only) => {
            this.diffs += 1
            this.order.push("diff")
            return git.diff(worktree, context, only)
          },
          grep: (worktree, term) => {
            this.greps += 1
            this.order.push("grep")
            const asked = git.grep(worktree, term)
            const waiting = this.greps === 1 && this.slowFirstGrepMs > 0
              ? this.slowFirstGrepMs
              : this.slowGrepMs
            return waiting === 0
              ? asked
              : Effect.andThen(Effect.sleep(`${waiting} millis`), asked)
          },
        }
      }),
    ).pipe(Layer.provide(GitLive))
  }

  diffsRun(): number {
    return this.diffs
  }

  grepsRun(): number {
    return this.greps
  }

  forgetGreps(): void {
    this.greps = 0
  }

  askedInOrder(): ReadonlyArray<string> {
    return this.order
  }

  forgetDiffs(): void {
    this.diffs = 0
  }

  private countKeys(setup: TestRendererSetup): void {
    const count = (): void => {
      this.keysSeen += 1
    }
    this.counting = count
    setup.renderer.keyInput.on("keypress", count)
  }

  private stopCounting(): void {
    const count = this.counting
    if (count === undefined) return
    this.setup?.renderer.keyInput.off("keypress", count)
    this.counting = undefined
  }

  private async pump(ready: () => boolean, attempts = PUMP_ATTEMPTS): Promise<boolean> {
    const setup = this.active()
    const settle = async (left: number): Promise<boolean> => {
      await setup.flush()
      if (ready()) return true
      if (left === 0) return false
      await new Promise((resolve) => setTimeout(resolve, PUMP_MS))
      return settle(left - 1)
    }
    return settle(attempts)
  }

  private stopWatching(): void {
    if (this.watching === undefined) return
    process.off("uncaughtException", this.watching)
    process.off("unhandledRejection", this.watching)
    this.watching = undefined
  }

  renderCrashes(): ReadonlyArray<string> {
    return this.crashes
  }

  private guard(): void {
    const first = this.crashes[0]
    if (first !== undefined) throw new Error(`the renderer crashed: ${first}`)
  }

  private active(): TestRendererSetup {
    const setup = this.setup
    if (setup === undefined) throw new Error("screen.open must run before the screen is driven")
    return setup
  }

  async pressKeys(keys: ReadonlyArray<string>): Promise<void> {
    this.state.tracer.sawKeys(keys, this.app?.shown()?.screen)
    const setup = this.active()
    for (const key of keys) {
      const chord = /^(ctrl|shift)\+(.+)$/.exec(key)
      if (chord === null) setup.mockInput.pressKey(sendable(key))
      else setup.mockInput.pressKey(sendable(chord[2] ?? ""), { [chord[1] ?? ""]: true })
    }
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  private async letterByLetter(text: string, everyMs: number): Promise<void> {
    const setup = this.active()
    await series(text.split(""), async (letter) => {
      await setup.mockInput.typeText(letter)
      await new Promise((resolve) => setTimeout(resolve, everyMs))
    })
  }

  async typeSlowly(text: string, everyMs: number): Promise<number> {
    this.state.tracer.sawText(text)
    const began = Date.now()
    await this.letterByLetter(text, everyMs)
    const took = Date.now() - began
    await this.app?.settled()
    await this.active().flush()
    return took
  }

  async typeText(text: string): Promise<void> {
    this.state.tracer.sawText(text)
    const setup = this.active()
    await setup.mockInput.typeText(text)
    await this.app?.settled()
    await setup.flush()
  }

  async paste(text: string): Promise<void> {
    const setup = this.active()
    await setup.mockInput.pasteBracketedText(text)
    await this.app?.settled()
    await setup.flush()
  }

  async untilShown(text: string): Promise<boolean> {
    const setup = this.active()
    const found = await this.pump(() => setup.captureCharFrame().includes(text), PUMP_LONG)
    this.guard()
    return found
  }

  async waitForNoticeToClear(notice: string): Promise<void> {
    const setup = this.active()
    await this.pump(() => !setup.captureCharFrame().includes(notice))
    this.guard()
  }

  async scroll(direction: Wheel, times = 1): Promise<void> {
    this.state.tracer.cannotReplay("the wheel")
    await this.burst(Array.from({ length: times }, () => direction))
  }

  async scrollTree(direction: "up" | "down", times = 1): Promise<void> {
    this.state.tracer.cannotReplay("the wheel")
    const setup = this.active()
    const y = Math.floor(setup.renderer.height / 2)
    await series(Array.from({ length: times }, (_, at) => at), () =>
      setup.mockMouse.scroll(4, y, direction),
    )
    await this.app?.settled()
    await setup.waitForVisualIdle()
    this.guard()
  }

  async panWith(direction: Wheel, times: number): Promise<void> {
    this.state.tracer.cannotReplay("the wheel")
    const setup = this.active()
    const x = Math.floor(setup.renderer.width / 2) + 6
    const y = Math.floor(setup.renderer.height / 2)
    await Promise.all(
      Array.from({ length: times }, () =>
        setup.mockMouse.scroll(x, y, direction, { modifiers: { shift: true } }),
      ),
    )
    await this.app?.settled()
    await setup.waitForVisualIdle()
    this.guard()
  }

  async scrollSlowly(direction: Wheel, times: number): Promise<void> {
    await series(
      Array.from({ length: times }, () => direction),
      (layer) => this.burst([layer]),
    )
  }

  async flickTree(direction: "up" | "down", times: number): Promise<void> {
    this.state.tracer.cannotReplay("the wheel")
    const setup = this.active()
    const y = Math.floor(setup.renderer.height / 2)
    await Promise.all(
      Array.from({ length: times }, () => setup.mockMouse.scroll(4, y, direction)),
    )
    await this.app?.settled()
    await setup.waitForVisualIdle()
    this.guard()
  }

  async burst(wheel: ReadonlyArray<Wheel>): Promise<number> {
    this.state.tracer.cannotReplay("the wheel")
    const setup = this.active()
    const x = Math.floor(WIDTH / 2) + 10
    const y = Math.floor(HEIGHT / 2)
    const started = performance.now()
    await Promise.all(wheel.map((direction) => setup.mockMouse.scroll(x, y, direction)))
    await this.app?.settled()
    await setup.waitForVisualIdle()
    const cost = performance.now() - started
    this.guard()
    return cost
  }

  async fire(wheel: ReadonlyArray<"up" | "down">): Promise<void> {
    const setup = this.active()
    const x = Math.floor(WIDTH / 2) + 10
    const y = Math.floor(HEIGHT / 2)
    await Promise.all(wheel.map((direction) => setup.mockMouse.scroll(x, y, direction)))
    await setup.flush()
  }

  async typeLoosely(text: string, everyMs: number): Promise<void> {
    this.state.tracer.cannotReplay("typing that overlaps an answer")
    await this.letterByLetter(text, everyMs)
    await this.active().flush()
  }

  async paused(everyMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, everyMs))
    await this.active().flush()
  }

  async waited(everyMs: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, everyMs))
    await this.app?.settled()
    await this.active().flush()
  }

  async rest(): Promise<void> {
    const setup = this.active()
    await series(
      Array.from({ length: REST_PASSES }, (_, pass) => pass),
      () => setup.waitForVisualIdle(),
    )
    await this.app?.settled()
    await setup.waitForVisualIdle()
    this.guard()
  }

  async dragOverDiff(fromY: number, toY: number): Promise<void> {
    const setup = this.active()
    const x = Math.floor(WIDTH / 2) + 10
    await setup.mockMouse.drag(x, fromY, x, toY)
    await this.app?.settled()
    await setup.waitForVisualIdle()
    this.guard()
  }

  async clickOnDiff(y: number): Promise<void> {
    const setup = this.active()
    const x = Math.floor(WIDTH / 2) + 10
    await setup.mockMouse.drag(x, y, x, y)
    await this.app?.settled()
    await setup.waitForVisualIdle()
    this.guard()
  }

  async dragAcrossDiff(y: number, fromX: number, toX: number): Promise<void> {
    this.state.tracer.cannotReplay("the mouse")
    const setup = this.active()
    await setup.mockMouse.drag(fromX, y, toX, y)
    await this.app?.settled()
    await setup.waitForVisualIdle()
    this.guard()
  }

  async selectableAt(x: number, y: number): Promise<boolean> {
    const setup = this.active()
    const at = setup.renderer.hitTest(x, y)
    const found = Renderable.renderablesByNumber.get(at)
    return found?.selectable === true
  }

  async pressEscape(): Promise<void> {
    this.state.tracer.sawKeys(["ESCAPE"], this.app?.shown()?.screen)
    const setup = this.active()
    const before = this.keysSeen
    setup.mockInput.pressEscape()
    await this.pump(() => this.keysSeen > before)
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async hoverAt(x: number, y: number): Promise<void> {
    this.state.tracer.cannotReplay("the mouse")
    const setup = this.active()
    await setup.mockMouse.moveTo(x, y)
    await this.app?.settled()
    await setup.flush()
  }

  async pressMeta(key: string): Promise<void> {
    this.state.tracer.cannotReplay("a meta key")
    const setup = this.active()
    setup.mockInput.pressKey(key, { meta: true })
    await this.app?.settled()
    await setup.flush()
  }

  async pressBackspaceWith(modifiers: {
    meta?: boolean
    option?: boolean
    super?: boolean
  }): Promise<void> {
    const setup = this.active()
    setup.mockInput.pressBackspace(modifiers)
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async pressCtrl(letter: string): Promise<void> {
    const setup = this.active()
    setup.mockInput.pressKey(letter, { ctrl: true })
    await this.app?.settled()
    await setup.flush()
  }

  async findForeground(marker: string): Promise<ReadonlyArray<string>> {
    return this.findPainted(marker, fgOf)
  }

  async believes(): Promise<{
    readonly focus: string
    readonly panes: ReadonlyArray<string>
    readonly scroll: number
    readonly cursor: number
    readonly wrap: boolean
    readonly sticky: boolean
    readonly hold: boolean
  }> {
    const app = this.app
    await app?.settled()
    return believedIn(app?.shown())
  }

  async paintedTop(): Promise<number> {
    const setup = this.active()
    await setup.waitForVisualIdle()
    const found = setup.renderer.root.findDescendantById("diff-code")
    return found instanceof CodeRenderable ? found.scrollY : -1
  }

  async caretOffset(): Promise<number> {
    const setup = this.active()
    await setup.waitForVisualIdle()
    const found = setup.renderer.root.findDescendantById("compose-body")
    return (found as unknown as { cursorOffset: number } | undefined)?.cursorOffset ?? -1
  }

  async paintedWith(marker: string): Promise<ReadonlyArray<string>> {
    const setup = this.active()
    const wanted = marker.toLowerCase()
    await this.settleHighlighting()
    this.guard()
    return setup
      .captureSpans()
      .lines.flatMap((line) => line.spans.filter((span) => bgOf(span) === wanted))
      .map((span) => span.text)
  }

  private async findPainted(
    marker: string,
    read: (span: Span) => string,
  ): Promise<ReadonlyArray<string>> {
    const setup = this.active()
    const wanted = marker.toLowerCase()
    const rows = (): ReadonlyArray<string> =>
      setup
        .captureSpans()
        .lines.filter((line) => line.spans.some((span) => read(span) === wanted))
        .map((line) => line.spans.map((span) => span.text).join("").trimEnd())
    await this.settleHighlighting()
    await this.pump(() => rows().length > 0)
    this.guard()
    return rows()
  }

  private async settleLayout(): Promise<void> {
    const setup = this.active()
    const laid = (): boolean => {
      const pane = setup.renderer.root.findDescendantById("diff-pane")
      if (pane !== undefined && !pane.visible) return true
      const found = setup.renderer.root.findDescendantById("diff-code")
      return !(found instanceof CodeRenderable) || found.width > 0
    }
    await this.pump(laid, LAYOUT_ATTEMPTS)
    await setup.flush()
    await setup.flush()
  }

  private async settleHighlighting(): Promise<void> {
    const setup = this.active()
    const code = (): CodeRenderable | undefined => {
      const found = setup.renderer.root.findDescendantById("diff-code")
      return found instanceof CodeRenderable ? found : undefined
    }
    const painted = (found: CodeRenderable): boolean =>
      Array.from({ length: HIGHLIGHT_LINES }, (_, line) => found.getLineHighlights(line)).some(
        (highlights) => highlights.length > 0,
      )
    const landed = (): boolean => {
      const found = code()
      return found === undefined || (!found.isHighlighting && painted(found))
    }
    await this.pump(landed)
    await code()?.highlightingDone
    await setup.waitForVisualIdle()
  }

  async pressTab(): Promise<void> {
    this.state.tracer.sawKeys(["TAB"], this.app?.shown()?.screen)
    const setup = this.active()
    setup.mockInput.pressTab({})
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async releaseShift(): Promise<void> {
    const setup = this.active()
    setup.renderer.keyInput.emit("keyrelease", {
      name: "leftshift",
      ctrl: false,
      meta: false,
      shift: false,
      option: false,
      sequence: "",
      number: false,
      raw: "",
      eventType: "release",
      source: "kitty",
    } as never)
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async pressShiftArrow(way: "up" | "down"): Promise<void> {
    this.state.tracer.sawKeys([way === "down" ? "shift+DOWN" : "shift+UP"])
    const setup = this.active()
    setup.mockInput.pressKey(way === "down" ? "ARROW_DOWN" : "ARROW_UP", { shift: true })
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async pressShiftTab(): Promise<void> {
    this.state.tracer.sawKeys(["shift+tab"], this.app?.shown()?.screen)
    const setup = this.active()
    setup.mockInput.pressTab({ shift: true })
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async listForegroundsOfEach(mark: string): Promise<ReadonlyArray<string>> {
    const setup = this.active()
    await setup.waitForVisualIdle()
    this.guard()
    const line = setup
      .captureSpans()
      .lines.find((candidate) => candidate.spans.map((span) => span.text).join("").includes(mark))
    if (line === undefined) return []
    return line.spans.flatMap((span) =>
      span.text
        .split("")
        .filter((character) => character === mark)
        .map(() => fgOf(span)),
    )
  }

  async listForegroundsOn(text: string): Promise<ReadonlyArray<string>> {
    const setup = this.active()
    await this.settleHighlighting()
    this.guard()
    const line = setup
      .captureSpans()
      .lines.find((candidate) => candidate.spans.map((span) => span.text).join("").includes(text))
    if (line === undefined) return []
    const whole = line.spans.map((span) => span.text).join("")
    const from = whole.indexOf(text)
    const to = from + text.length
    let at = 0
    const painted: Array<string> = []
    for (const span of line.spans) {
      const ends = at + span.text.length
      if (at < to && ends > from && span.text.trim().length > 0) painted.push(fgOf(span))
      at = ends
    }
    return [...new Set(painted)]
  }

  async findHighlighted(marker: string): Promise<ReadonlyArray<string>> {
    return this.findPainted(marker, bgOf)
  }

  watchClipboard(): void {
    if (this.wrote !== undefined) return
    const original = process.stdout.write.bind(process.stdout)
    this.wrote = original
    const spy = (chunk: unknown, ...rest: ReadonlyArray<unknown>): boolean => {
      this.written.push(String(chunk))
      return (original as (...args: ReadonlyArray<unknown>) => boolean)(chunk, ...rest)
    }
    process.stdout.write = spy
  }

  async copied(): Promise<string> {
    await this.settleLayout()
    const found = [...this.written.join("").matchAll(CLIP)].at(-1)?.[1] ?? ""
    return Buffer.from(found, "base64").toString("utf8")
  }

  private stopWatchingClipboard(): void {
    if (this.wrote === undefined) return
    process.stdout.write = this.wrote
    this.wrote = undefined
    this.written = []
  }

  async findPicked(): Promise<ReadonlyArray<string>> {
    const found = await Promise.all(
      [palette.pickedOn, palette.pickedOnAdded, palette.pickedOnRemoved].map((one) =>
        this.findPainted(one, bgOf),
      ),
    )
    return found.flat()
  }

  async findUnderCursor(): Promise<ReadonlyArray<string>> {
    const found = await Promise.all(
      [palette.cursorOn, palette.cursorOnAdded, palette.cursorOnRemoved].map((one) =>
        this.findPainted(one, bgOf),
      ),
    )
    return found.flat()
  }

  async waitForFrame(wanted: string): Promise<string> {
    const setup = this.active()
    await this.pump(() => setup.captureCharFrame().includes(wanted))
    return this.getFrame()
  }

  async resize(width: number, height: number): Promise<void> {
    const setup = this.active()
    setup.renderer.resize(width, height)
    await this.settleLayout()
    await setup.waitForVisualIdle()
  }

  async rows(): Promise<ReadonlyArray<string>> {
    return (await this.getFrame()).split("\n")
  }

  async rowWith(text: string): Promise<string> {
    return (await this.rows()).find((row) => row.includes(text)) ?? ""
  }

  async rowOf(text: string): Promise<number> {
    return (await this.rows()).findIndex((row) => row.includes(text))
  }

  async footer(): Promise<string> {
    const rows = await this.rows()
    return rows.findLast((row) => row.trim().length > 0) ?? ""
  }

  async writeComment(body: string): Promise<void> {
    await this.pressKeys(["c"])
    await this.typeText(body)
    await this.pressCtrl("s")
  }

  private async rowFor(text: string): Promise<number> {
    const at = await this.rowOf(text)
    if (at < 0) throw new Error(`no row on the screen holds ${text}`)
    return at
  }

  async clickOnLine(text: string): Promise<void> {
    await this.clickOnDiff(await this.rowFor(text))
  }

  async dragOverLines(from: string, to: string): Promise<void> {
    const start = await this.rowFor(from)
    await this.dragOverDiff(start, await this.rowFor(to))
  }

  async getFrame(): Promise<string> {
    const setup = this.active()
    await this.settleLayout()
    await setup.waitForVisualIdle()
    this.guard()
    return setup.captureCharFrame()
  }

  private async restCode(): Promise<void> {
    const setup = this.setup
    if (setup === undefined) return
    setup.renderer.stop()
    const resting = HIGHLIGHTED.map((id) => setup.renderer.root.findDescendantById(id))
      .filter((found) => found instanceof CodeRenderable)
      .map((found) => found.highlightingDone)
    await Promise.all(resting)
  }

  async close(): Promise<void> {
    this.stopWatching()
    this.stopWatchingClipboard()
    this.stopCounting()
    await this.restCode()
    this.setup?.renderer.destroy()
    this.setup = undefined
    this.app = undefined
    const scope = this.scope
    this.scope = undefined
    if (scope !== undefined) await Effect.runPromise(Scope.close(scope, Exit.void))
  }
}
