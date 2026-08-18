import { CodeRenderable, Renderable } from "@opentui/core"
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { Effect, Exit, Layer, Scope } from "effect"
import { GitLive } from "../../../service/git/index.ts"
import { ForgeLive } from "../../../service/forge/index.ts"
import { storeAt } from "../../../service/store/index.ts"
import { launch } from "../../../tui/index.ts"
import type { App } from "../../../tui/index.ts"
import { series, type DriverState } from "../../state.ts"

const hex = (value: number): string => value.toString(16).padStart(2, "0")

const fgOf = (span: Span): string =>
  `#${hex(Math.round(span.fg.r * 255))}${hex(Math.round(span.fg.g * 255))}${hex(Math.round(span.fg.b * 255))}`

const bgOf = (span: Span): string =>
  `#${hex(Math.round(span.bg.r * 255))}${hex(Math.round(span.bg.g * 255))}${hex(Math.round(span.bg.b * 255))}`

export type Wheel = "up" | "down" | "left" | "right"

const PUMP_MS = 4
const PUMP_ATTEMPTS = 250
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
}

export class ScreenTestDriver {
  private setup: TestRendererSetup | undefined
  private scope: Scope.Closeable | undefined
  private app: App | undefined
  private readonly crashes: Array<string> = []
  private watching: ((cause: unknown) => void) | undefined
  private keysSeen = 0
  private counting: (() => void) | undefined

  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  async open(options: OpenOptions = {}): Promise<void> {
    if (options.upgrades === true) delete process.env["ADIFF_NO_UPGRADE_CHECK"]
    else process.env["ADIFF_NO_UPGRADE_CHECK"] = "1"
    const setup = await createTestRenderer({
      width: options.width ?? WIDTH,
      height: options.height ?? HEIGHT,
    })
    this.setup = setup
    this.watch()
    this.countKeys(setup)
    const layer = Layer.mergeAll(GitLive, ForgeLive, storeAt(this.state.storeRoot))
    const scope = Scope.makeUnsafe()
    this.scope = scope
    const context = await Effect.runPromise(Layer.buildWithScope(layer, scope))
    this.app = await Effect.runPromise(
      launch(options.repo ?? this.state.repo, setup.renderer, {
        noticeMs: NOTICE_MS,
        sessionPath: this.state.sessionPath,
        branch: options.branch,
      }).pipe(
        Effect.provideContext(context),
      ),
    )
    await this.app.settled()
    await setup.waitForVisualIdle()
  }

  async restart(options: OpenOptions = {}): Promise<void> {
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
    const setup = this.active()
    await setup.mockInput.pressKeys([...keys])
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async typeText(text: string): Promise<void> {
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

  async waitForNoticeToClear(notice: string): Promise<void> {
    const setup = this.active()
    await this.pump(() => !setup.captureCharFrame().includes(notice))
    this.guard()
  }

  async scroll(direction: Wheel, times = 1): Promise<void> {
    await this.burst(Array.from({ length: times }, () => direction))
  }

  async scrollTree(direction: "up" | "down", times = 1): Promise<void> {
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

  async burst(wheel: ReadonlyArray<Wheel>): Promise<number> {
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

  async dragAcrossDiff(y: number, fromX: number, toX: number): Promise<void> {
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
    const setup = this.active()
    const before = this.keysSeen
    setup.mockInput.pressEscape()
    await this.pump(() => this.keysSeen > before)
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async hoverAt(x: number, y: number): Promise<void> {
    const setup = this.active()
    await setup.mockMouse.moveTo(x, y)
    await this.app?.settled()
    await setup.flush()
  }

  async pressMeta(key: string): Promise<void> {
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
    const setup = this.active()
    setup.mockInput.pressKey(way === "down" ? "ARROW_DOWN" : "ARROW_UP", { shift: true })
    await this.app?.settled()
    await setup.waitForVisualIdle()
  }

  async pressShiftTab(): Promise<void> {
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

  async debugSpans(): Promise<ReadonlyArray<string>> {
    const setup = this.active()
    await setup.waitForVisualIdle()
    return setup
      .captureSpans()
      .lines.map((line) =>
        line.spans.map((span) => `${bgOf(span)}:${span.text.trimEnd()}`).filter((s) => s.length > 8).join(" | "),
      )
  }

  async lastFailure(): Promise<string> {
    return this.app?.lastFailure() ?? ""
  }

  async waitForFrame(wanted: string): Promise<string> {
    const setup = this.active()
    await this.pump(() => setup.captureCharFrame().includes(wanted))
    return this.getFrame()
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
