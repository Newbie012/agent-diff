import { Effect } from "effect"
import { Store, storeAt, type Batch } from "../../../service/store/index.ts"
import type { DriverState } from "../../state.ts"

export type DeliveredComment = {
  readonly body: string
  readonly file: string
  readonly side: string
  readonly start: number
  readonly end: number
  readonly snippet: string
}

export class AgentTestDriver {
  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  async listBatches(worktree: string): Promise<ReadonlyArray<Batch>> {
    const read = Effect.gen(function* () {
      const store = yield* Store
      return yield* store.inbox(worktree)
    })
    return Effect.runPromise(read.pipe(Effect.provide(storeAt(this.state.storeRoot))))
  }

  async listComments(worktree: string): Promise<ReadonlyArray<DeliveredComment>> {
    const batches = await this.listBatches(worktree)
    return batches.flatMap((batch) =>
      batch.comments.map((comment) => ({
        body: comment.body,
        file: comment.anchor.path,
        side: comment.anchor.side,
        start: comment.anchor.start,
        end: comment.anchor.end,
        snippet: comment.anchor.snippet,
      })),
    )
  }
}
