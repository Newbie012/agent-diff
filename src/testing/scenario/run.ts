import { TestDriver } from "../driver.ts"
import { series } from "../state.ts"
import { noteChecksWith, noteSubject } from "./checking.ts"
import { tracing } from "./trace.ts"
import { View } from "./view.ts"
import { applyWorld, type WorldHands } from "./world.ts"
import type { Scenario, Step } from "./model.ts"
import type { CreatedBranch } from "../domains/branch/index.ts"
import type { DeliveredComment } from "../domains/agent/index.ts"

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
  private worktree = ""
  private branch: CreatedBranch | undefined

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
    noteChecksWith((does, about) =>
      this.driver.tracerHere().sawCheck(
        about?.noun === undefined ? does : `${about.noun} ${does}`,
        about?.where,
      ),
    )
  }

  private hands(): WorldHands {
    return {
      branch: async (held) => {
        const branch = await this.driver.branch.create(held)
        this.branch = branch
        this.worktree = branch.worktree
      },
      layers: async (held) => {
        await this.driver.app.runLayersSet(this.worktree, held)
      },
      remarks: async (held) => {
        await this.driver.forge.holds([{ branch: this.branch?.name ?? "", threads: held }])
      },
      readsRemarks: async (held) => {
        if (held) await this.driver.app.runConfigSet("remarks", true)
      },
    }
  }

  private async build(): Promise<void> {
    this.noteChecks()
    await applyWorld(this.said.world, this.hands())
    await this.driver.screen.open({ width: this.said.seat.width, height: this.said.seat.height })
    await series(this.said.steps, (step) => this.take(step))
  }

  private async take(step: Step): Promise<void> {
    const tracer = this.driver.tracerHere()
    if (step.change !== undefined && this.branch !== undefined) {
      const { file, lines, message } = step.change
      await this.driver.branch.changeAndCommit(this.branch, file, lines, message)
      tracer.sawChange(step.does, step.change)
      return
    }
    tracer.sawStep(step)
    tracer.mute(true)
    await series(step.keys, (token) => this.reach(token))
    tracer.mute(false)
  }

  private async reach(token: string): Promise<void> {
    if (/^(wait|until):/.test(token)) return
    if (token === "escape") {
      await this.driver.screen.pressEscape()
      return
    }
    if (token === "tab") {
      await this.driver.screen.pressTab()
      return
    }
    if (token === "shift-tab") {
      await this.driver.screen.pressShiftTab()
      return
    }
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

  async whatTheAgentGot(): Promise<ReadonlyArray<DeliveredComment>> {
    noteSubject({ noun: "what the agent got" })
    return this.driver.agent.listComments(this.worktree)
  }

  async howManyTimesTheAgentWasTold(): Promise<number> {
    noteSubject({ noun: "the hand-overs the agent got" })
    return (await this.driver.agent.listBatches(this.worktree)).length
  }

  async sees(): Promise<View> {
    return new View(this.driver.screen, await this.driver.screen.getFrame())
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.driver[Symbol.asyncDispose]()
  }
}

export const reviewing = (said: Scenario): Promise<Review> => Review.of(said)
