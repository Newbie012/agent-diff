import { AgentTestDriver } from "./domains/agent/index.ts"
import { AppTestDriver } from "./domains/app/index.ts"
import { BranchTestDriver } from "./domains/branch/index.ts"
import { createDriverState, type DriverState } from "./state.ts"

export class TestDriver implements AsyncDisposable {
  readonly branch: BranchTestDriver
  readonly app: AppTestDriver
  readonly agent: AgentTestDriver

  private constructor(private readonly state: DriverState) {
    this.branch = new BranchTestDriver(state)
    this.app = new AppTestDriver(state)
    this.agent = new AgentTestDriver(state)
  }

  static async create(): Promise<TestDriver> {
    return new TestDriver(await createDriverState())
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.state.dispose()
  }
}
