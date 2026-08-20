import { TestDriver } from "../driver.ts"
import { series } from "../state.ts"
import { noteChecksWith } from "./checking.ts"
import { tracing } from "./trace.ts"
import { View } from "./view.ts"
import type { Scenario, Step } from "./model.ts"

const NAMED: Readonly<Record<string, string>> = {
  enter: "RETURN",
  escape: "ESCAPE",
  tab: "TAB",
  "shift-tab": "shift+tab",
  up: "UP",
  down: "DOWN",
  left: "LEFT",
  right: "RIGHT",
}

const typed = (token: string): string | undefined =>
  token.startsWith("text:") ? token.slice("text:".length) : undefined

const bound = (token: string): string =>
  NAMED[token] ?? (token.startsWith("ctrl-") ? `ctrl+${token.slice("ctrl-".length)}` : token)

export class Review implements AsyncDisposable {
  readonly driver: TestDriver
  private readonly said: Scenario

  private constructor(driver: TestDriver, said: Scenario) {
    this.driver = driver
    this.said = said
  }

  static async of(said: Scenario): Promise<Review> {
    const driver = await TestDriver.create()
    const review = new Review(driver, said)
    await review.build()
    return review
  }

  private noteChecks(): void {
    if (!tracing()) return
    noteChecksWith((does) => this.driver.tracerHere().sawCheck(does))
  }

  private async build(): Promise<void> {
    this.noteChecks()
    const branch = await this.driver.branch.create(this.said.world.branch)
    const layers = this.said.world.layers
    if (layers !== undefined) await this.driver.app.runLayersSet(branch.worktree, layers)
    await this.driver.screen.open({ width: this.said.seat.width, height: this.said.seat.height })
    await series(this.said.steps, (step) => this.take(step))
  }

  private take(step: Step): Promise<void> {
    return series(step.keys, (token) => this.reach(token))
  }

  private async reach(token: string): Promise<void> {
    if (/^(wait|until):/.test(token)) return
    const text = typed(token)
    if (text === undefined) {
      await this.driver.screen.pressKeys([bound(token)])
      return
    }
    if (text.length === 1) {
      await this.driver.screen.pressKeys([text])
      return
    }
    await this.driver.screen.typeText(text)
  }

  async andThen(...steps: ReadonlyArray<Step>): Promise<View> {
    await series(steps, (step) => this.take(step))
    return this.sees()
  }

  async sees(): Promise<View> {
    return new View(this.driver.screen, await this.driver.screen.getFrame())
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.driver[Symbol.asyncDispose]()
  }
}

export const reviewing = (said: Scenario): Promise<Review> => Review.of(said)
