import { mkdir, readFile, appendFile, writeFile } from "node:fs/promises"
import { Context, Effect, Layer, Option } from "effect"
import { StoreUnreadable, StoreUnwritable } from "./error.ts"
import { emptyBranchState, type Batch, type BranchState } from "./model.ts"
import { branchDir, defaultRoot, inboxPath, statePath } from "./paths.ts"

type Shape = {
  readonly root: string
  readonly submit: (worktreePath: string, batch: Batch) => Effect.Effect<void, StoreUnwritable>
  readonly inbox: (worktreePath: string) => Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable>
  readonly state: (worktreePath: string) => Effect.Effect<BranchState, StoreUnreadable>
  readonly saveState: (
    worktreePath: string,
    state: BranchState,
  ) => Effect.Effect<void, StoreUnwritable>
  readonly take: (
    worktreePath: string,
  ) => Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable | StoreUnwritable>
}

export class Store extends Context.Service<Store, Shape>()("adiff/Store") {}

const ensureDir = Effect.fn("Store.ensureDir")(function* (path: string) {
  return yield* Effect.tryPromise({
    try: () => mkdir(path, { recursive: true }),
    catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
  })
})

const readOptional = Effect.fn("Store.readOptional")(function* (path: string) {
  return yield* Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => new StoreUnreadable({ path, reason: String(cause) }),
  }).pipe(Effect.map(Option.some), Effect.catchTag("StoreUnreadable", () => missing))
})

const missing = Effect.succeed(Option.none<string>())

const parseBatches = (raw: string): ReadonlyArray<Batch> =>
  raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Batch)

const parseState = (raw: string): BranchState => ({
  ...emptyBranchState,
  ...(JSON.parse(raw) as Partial<BranchState>),
})

const makeStore = (root: string): Shape => {
  const submit = Effect.fn("Store.submit")(function* (worktreePath: string, batch: Batch) {
    const path = inboxPath(root, worktreePath)
    yield* ensureDir(branchDir(root, worktreePath))
    yield* Effect.tryPromise({
      try: () => appendFile(path, `${JSON.stringify(batch)}\n`, "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  const inbox = Effect.fn("Store.inbox")(function* (worktreePath: string) {
    const raw = yield* readOptional(inboxPath(root, worktreePath))
    return Option.match(raw, { onNone: (): ReadonlyArray<Batch> => [], onSome: parseBatches })
  })

  const state = Effect.fn("Store.state")(function* (worktreePath: string) {
    const raw = yield* readOptional(statePath(root, worktreePath))
    return Option.match(raw, { onNone: () => emptyBranchState, onSome: parseState })
  })

  const saveState = Effect.fn("Store.saveState")(function* (
    worktreePath: string,
    next: BranchState,
  ) {
    const path = statePath(root, worktreePath)
    yield* ensureDir(branchDir(root, worktreePath))
    yield* Effect.tryPromise({
      try: () => writeFile(path, JSON.stringify(next, undefined, 2), "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  const take = Effect.fn("Store.take")(function* (worktreePath: string) {
    const batches = yield* inbox(worktreePath)
    const current = yield* state(worktreePath)
    const pending = batches.slice(current.consumed)
    if (pending.length > 0) {
      yield* saveState(worktreePath, { ...current, consumed: batches.length })
    }
    return pending
  })

  return { root, submit, inbox, state, saveState, take }
}

export const storeAt = (root: string): Layer.Layer<Store> => Layer.succeed(Store)(makeStore(root))

export const StoreLive = storeAt(defaultRoot())
