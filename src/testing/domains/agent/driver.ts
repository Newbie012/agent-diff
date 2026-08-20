import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { Effect } from "effect"
import { reportsDir, Store, storeAt, type Batch } from "../../../service/store/index.ts"
import type { Side } from "../../../domain/patch/index.ts"
import type { DriverState } from "../../state.ts"

export type DeliveredComment = {
  readonly id: string
  readonly body: string
  readonly file: string
  readonly side: string
  readonly start: number
  readonly end: number
  readonly snippet: string
}

const SEEDED_AT = "2026-01-01T00:00:00.000Z"

export type Seeded = {
  readonly worktree: string
  readonly head: string
  readonly file: string
  readonly line: number
  readonly comment: string
  readonly answer: string
  readonly id?: string
  readonly snippet?: string
  readonly asks?: boolean
}

export class AgentTestDriver {
  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  async listReports(): Promise<ReadonlyArray<string>> {
    const directory = reportsDir(this.state.storeRoot)
    const names = await readdir(directory).catch(() => [])
    return Promise.all(names.map((name) => readFile(join(directory, name), "utf8")))
  }

  async seedAnswered(seed: Seeded): Promise<void> {
    const comment = {
      id: seed.id ?? "seeded",
      anchor: {
        path: seed.file,
        side: "new" as Side,
        start: seed.line,
        end: seed.line,
        blob: "",
        snippet: seed.snippet ?? "",
      },
      body: seed.comment,
    }
    const write = Effect.gen(function* () {
      const store = yield* Store
      yield* store.submit(seed.worktree, {
        id: "seeded-batch",
        at: SEEDED_AT,
        head: seed.head,
        comments: [comment],
      })
      yield* store.answer(seed.worktree, {
        comment: comment.id,
        body: seed.answer,
        head: seed.head,
        asks: seed.asks ?? false,
        at: SEEDED_AT,
      })
    })
    await Effect.runPromise(write.pipe(Effect.provide(storeAt(this.state.storeRoot))))
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
        id: comment.id,
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
