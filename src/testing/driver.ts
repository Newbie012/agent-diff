import { AgentTestDriver } from "./domains/agent/index.ts"
import { AppTestDriver } from "./domains/app/index.ts"
import { BranchTestDriver } from "./domains/branch/index.ts"
import { ScreenTestDriver } from "./domains/screen/index.ts"
import { createDriverState, type DriverOptions, type DriverState } from "./state.ts"

export class TestDriver implements AsyncDisposable {
  readonly repoPath: string
  readonly storeRoot: string
  readonly workspacePath: string
  readonly branch: BranchTestDriver
  readonly app: AppTestDriver
  readonly agent: AgentTestDriver
  readonly screen: ScreenTestDriver

  private readonly state: DriverState

  private constructor(state: DriverState) {
    this.state = state
    this.repoPath = state.repo
    this.storeRoot = state.storeRoot
    this.workspacePath = state.workspace
    this.branch = new BranchTestDriver(state)
    this.app = new AppTestDriver(state)
    this.agent = new AgentTestDriver(state)
    this.screen = new ScreenTestDriver(state)
  }

  static async create(options: DriverOptions = {}): Promise<TestDriver> {
    return new TestDriver(await createDriverState(options))
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.screen.close()
    await this.state.dispose()
  }
}
