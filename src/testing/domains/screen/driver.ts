import { CodeRenderable } from "@opentui/core"
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { Effect, Exit, Layer, Scope } from "effect"
import { GitLive } from "../../../service/git/index.ts"
import { storeAt } from "../../../service/store/index.ts"
import { launch } from "../../../tui/index.ts"
import type { App } from "../../../tui/index.ts"
import { series, type DriverState } from "../../state.ts"

const hex = (value: number): string => value.toString(16).padStart(2, "0")

const fgOf = (span: Span): string =>
  `#${hex(Math.round(span.fg.r * 255))}${hex(Math.round(span.fg.g * 255))}${hex(Math.round(span.fg.b * 255))}`

const bgOf = (span: Span): string =>
  `#${hex(Math.round(span.bg.r * 255))}${hex(Math.round(span.bg.g * 255))}${hex(Math.round(span.bg.b * 255))}`

const ESCAPE_FLUSH_MS = 150
const REST_MS = 400
const PAINT_ATTEMPTS = 20
const PAINT_WAIT_MS = 50

type Span = { readonly fg: Channels; readonly bg: Channels }

type Channels = { r: number; g: number; b: number }
const NOTICE_MS = 900
const WIDTH = 120
const HEIGHT = 32

export type OpenOptions = {
  readonly width?: number
  readonly height?: number
}

export class ScreenTestDriver {
  private setup: TestRendererSetup | undefined
  private scope: Scope.Closeable | undefined
  private app: App | undefined
  private readonly crashes: Array<string> = []
  private watching: ((cause: unknown) => void) | undefined

  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  async open(options: OpenOptions = {}): Promise<void> {
    const setup = await createTestRenderer({
      width: options.width ?? WIDTH,
      height: options.height ?? HEIGHT,
    })
    this.setup = setup
    this.watch()
    const layer = Layer.mergeAll(GitLive, storeAt(this.state.storeRoot))
    const scope = Scope.makeUnsafe()
    this.scope = scope
    const context = await Effect.runPromise(Layer.buildWithScope(layer, scope))
    this.app = await Effect.runPromise(
      launch(this.state.repo, setup.renderer, NOTICE_MS, this.state.sessionPath).pipe(
        Effect.provideContext(context),
      ),
    )
    await this.app.settled()
    await setup.waitForVisualIdle()
  }

  async restart(): Promise<void> {
    await this.close()
    await this.open()
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

  async waitForNoticeToClear(): Promise<void> {
    const setup = this.active()
    await new Promise((resolve) => setTimeout(resolve, NOTICE_MS + 300))
    await setup.flush()
  }

  async scroll(direction: "up" | "down", times = 1): Promise<void> {
    await this.burst(Array.from({ length: times }, () => direction))
  }

  async scrollSlowly(direction: "up" | "down", times: number): Promise<void> {
    await series(
      Array.from({ length: times }, () => direction),
      (step) => this.burst([step]),
    )
  }

  async burst(wheel: ReadonlyArray<"up" | "down">): Promise<number> {
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
    await new Promise((resolve) => setTimeout(resolve, REST_MS))
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

  async pressEscape(): Promise<void> {
    const setup = this.active()
    setup.mockInput.pressEscape()
    await new Promise((resolve) => setTimeout(resolve, ESCAPE_FLUSH_MS))
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

  private async findPainted(
    marker: string,
    read: (span: Span) => string,
  ): Promise<ReadonlyArray<string>> {
    const setup = this.active()
    const wanted = marker.toLowerCase()
    const rows = (): ReadonlyArray<string> =>
      setup
        .captureSpans()
        .lines.filter((line) => line.spans.some((span) => read(span as Span) === wanted))
        .map((line) => line.spans.map((span) => span.text).join("").trimEnd())
    const attempt = async (left: number): Promise<ReadonlyArray<string>> => {
      await setup.waitForVisualIdle()
      this.guard()
      const found = rows()
      if (found.length > 0 || left === 0) return found
      await new Promise((resolve) => setTimeout(resolve, PAINT_WAIT_MS))
      return attempt(left - 1)
    }
    return attempt(PAINT_ATTEMPTS)
  }

  private async settleHighlighting(): Promise<void> {
    const setup = this.active()
    const attempt = async (left: number): Promise<void> => {
      await setup.waitForVisualIdle()
      const found = setup.renderer.root.findDescendantById("diff-code")
      if (left === 0 || !(found instanceof CodeRenderable) || !found.isHighlighting) return
      await found.highlightingDone
      return attempt(left - 1)
    }
    await attempt(PAINT_ATTEMPTS)
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
      if (at < to && ends > from && span.text.trim().length > 0) painted.push(fgOf(span as Span))
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

  async getFrame(): Promise<string> {
    const setup = this.active()
    await setup.waitForVisualIdle()
    this.guard()
    return setup.captureCharFrame()
  }

  async close(): Promise<void> {
    this.stopWatching()
    this.setup?.renderer.destroy()
    this.setup = undefined
    this.app = undefined
    const scope = this.scope
    this.scope = undefined
    if (scope !== undefined) await Effect.runPromise(Scope.close(scope, Exit.void))
  }
}
