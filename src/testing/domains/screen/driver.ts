import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing"
import { Effect, Exit, Layer, Scope } from "effect"
import { GitLive } from "../../../service/git/index.ts"
import { storeAt } from "../../../service/store/index.ts"
import { launch } from "../../../tui/index.ts"
import type { App } from "../../../tui/index.ts"
import type { DriverState } from "../../state.ts"

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
    const layer = Layer.mergeAll(GitLive, storeAt(this.state.storeRoot))
    const scope = Scope.makeUnsafe()
    this.scope = scope
    const context = await Effect.runPromise(Layer.buildWithScope(layer, scope))
    this.app = await Effect.runPromise(launch(this.state.repo, setup.renderer).pipe(Effect.provideContext(context)))
    await setup.waitForVisualIdle()
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

  async pressCtrl(letter: string): Promise<void> {
    const setup = this.active()
    setup.mockInput.pressKey(letter, { ctrl: true })
    await this.app?.settled()
    await setup.flush()
  }

  async getFrame(): Promise<string> {
    const setup = this.active()
    await setup.waitForVisualIdle()
    return setup.captureCharFrame()
  }

  async close(): Promise<void> {
    this.setup?.renderer.destroy()
    this.setup = undefined
    this.app = undefined
    const scope = this.scope
    this.scope = undefined
    if (scope !== undefined) await Effect.runPromise(Scope.close(scope, Exit.void))
  }
}
