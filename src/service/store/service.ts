import { mkdir, readFile, appendFile, writeFile } from "node:fs/promises"
import { Context, Effect, Layer, Option } from "effect"
import { StoreUnreadable, StoreUnwritable } from "./error.ts"
import {
  emptyBranchState,
  type Batch,
  type BranchState,
  type StoredAnswer,
  type StoredComment,
  type Settings,
  type StoredLayers,
} from "./model.ts"
import {
  branchDir,
  defaultRoot,
  inboxPath,
  outboxPath,
  reportPath,
  reportsDir,
  settingsPath,
  statePath,
  layersPath,
} from "./paths.ts"

type Shape = {
  readonly root: string
  readonly submit: (worktreePath: string, batch: Batch) => Effect.Effect<void, StoreUnwritable>
  readonly inbox: (worktreePath: string) => Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable>
  readonly state: (worktreePath: string) => Effect.Effect<BranchState, StoreUnreadable>
  readonly saveState: (
    worktreePath: string,
    state: BranchState,
  ) => Effect.Effect<void, StoreUnwritable>
  readonly stage: (
    worktreePath: string,
    comment: StoredComment,
  ) => Effect.Effect<ReadonlyArray<StoredComment>, StoreUnreadable | StoreUnwritable>
  readonly restage: (
    worktreePath: string,
    comment: StoredComment,
  ) => Effect.Effect<Option.Option<ReadonlyArray<StoredComment>>, StoreUnreadable | StoreUnwritable>
  readonly unstage: (
    worktreePath: string,
    id: string,
  ) => Effect.Effect<Option.Option<ReadonlyArray<StoredComment>>, StoreUnreadable | StoreUnwritable>
  readonly saveReport: (stamp: string, text: string) => Effect.Effect<string, StoreUnwritable>
  readonly settings: Effect.Effect<Settings, StoreUnreadable>
  readonly saveSettings: (next: Settings) => Effect.Effect<void, StoreUnwritable>
  readonly layers: (
    worktreePath: string,
  ) => Effect.Effect<Option.Option<StoredLayers>, StoreUnreadable>
  readonly saveLayers: (
    worktreePath: string,
    layers: StoredLayers,
  ) => Effect.Effect<void, StoreUnwritable>
  readonly take: (
    worktreePath: string,
  ) => Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable | StoreUnwritable>
  readonly answer: (
    worktreePath: string,
    answer: StoredAnswer,
  ) => Effect.Effect<void, StoreUnwritable>
  readonly answers: (
    worktreePath: string,
  ) => Effect.Effect<ReadonlyArray<StoredAnswer>, StoreUnreadable>
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

const parseSettings = (raw: string): Settings => {
  const parsed = JSON.parse(raw) as Partial<Settings>
  return typeof parsed.wrap === "boolean" ? { wrap: parsed.wrap } : {}
}

const parseBatches = (raw: string): ReadonlyArray<Batch> =>
  raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Batch)

const parseAnswers = (raw: string): ReadonlyArray<StoredAnswer> =>
  raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as StoredAnswer)

const parseState = (raw: string): BranchState => ({
  ...emptyBranchState,
  ...(JSON.parse(raw) as Partial<BranchState>),
})

type Reader = (worktreePath: string) => Effect.Effect<BranchState, StoreUnreadable>
type Writer = (worktreePath: string, next: BranchState) => Effect.Effect<void, StoreUnwritable>
type Inbox = (worktreePath: string) => Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable>

const cursorOps = (state: Reader, saveState: Writer, inbox: Inbox) => {
  const stage = Effect.fn("Store.stage")(function* (worktreePath: string, comment: StoredComment) {
    const current = yield* state(worktreePath)
    const pending = [...current.pending, comment]
    yield* saveState(worktreePath, { ...current, pending })
    return pending
  })

  const restage = Effect.fn("Store.restage")(function* (
    worktreePath: string,
    comment: StoredComment,
  ) {
    const current = yield* state(worktreePath)
    if (!current.pending.some((entry) => entry.id === comment.id)) return Option.none()
    const pending = current.pending.map((entry) => (entry.id === comment.id ? comment : entry))
    yield* saveState(worktreePath, { ...current, pending })
    return Option.some(pending)
  })

  const unstage = Effect.fn("Store.unstage")(function* (worktreePath: string, id: string) {
    const current = yield* state(worktreePath)
    if (!current.pending.some((entry) => entry.id === id)) return Option.none()
    const pending = current.pending.filter((entry) => entry.id !== id)
    yield* saveState(worktreePath, { ...current, pending })
    return Option.some(pending)
  })

  const take = Effect.fn("Store.take")(function* (worktreePath: string) {
    const batches = yield* inbox(worktreePath)
    const current = yield* state(worktreePath)
    const pending = batches.slice(current.consumed)
    if (pending.length > 0) yield* saveState(worktreePath, { ...current, consumed: batches.length })
    return pending
  })

  return { stage, restage, unstage, take }
}

const settingsOps = (root: string) => {
  const settings = Effect.gen(function* () {
    const raw = yield* readOptional(settingsPath(root))
    return Option.match(raw, { onNone: (): Settings => ({}), onSome: parseSettings })
  }).pipe(Effect.withSpan("Store.settings"))

  const saveSettings = Effect.fn("Store.saveSettings")(function* (next: Settings) {
    const path = settingsPath(root)
    yield* ensureDir(root)
    yield* Effect.tryPromise({
      try: () => writeFile(path, JSON.stringify(next), "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  return { settings, saveSettings }
}

const reportOps = (root: string) =>
  Effect.fn("Store.saveReport")(function* (stamp: string, text: string) {
    const path = reportPath(root, stamp)
    yield* ensureDir(reportsDir(root))
    yield* Effect.tryPromise({
      try: () => writeFile(path, text, "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
    return path
  })

const answerOps = (root: string) => {
  const answer = Effect.fn("Store.answer")(function* (worktreePath: string, entry: StoredAnswer) {
    const path = outboxPath(root, worktreePath)
    yield* ensureDir(branchDir(root, worktreePath))
    yield* Effect.tryPromise({
      try: () => appendFile(path, `${JSON.stringify(entry)}\n`, "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  const answers = Effect.fn("Store.answers")(function* (worktreePath: string) {
    const raw = yield* readOptional(outboxPath(root, worktreePath))
    return Option.match(raw, {
      onNone: (): ReadonlyArray<StoredAnswer> => [],
      onSome: parseAnswers,
    })
  })

  return { answer, answers }
}

const layersOps = (root: string) => {
  const layers = Effect.fn("Store.layers")(function* (worktreePath: string) {
    const raw = yield* readOptional(layersPath(root, worktreePath))
    return Option.map(raw, (text) => JSON.parse(text) as StoredLayers)
  })

  const saveLayers = Effect.fn("Store.saveLayers")(function* (
    worktreePath: string,
    next: StoredLayers,
  ) {
    const path = layersPath(root, worktreePath)
    yield* ensureDir(branchDir(root, worktreePath))
    yield* Effect.tryPromise({
      try: () => writeFile(path, JSON.stringify(next, undefined, 2), "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  return { layers, saveLayers }
}

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

  const cursors = cursorOps(state, saveState, inbox)
  return {
    root,
    submit,
    inbox,
    state,
    saveState,
    saveReport: reportOps(root),
    ...settingsOps(root),
    ...answerOps(root),
    ...layersOps(root),
    ...cursors,
  }
}

export const storeAt = (root: string): Layer.Layer<Store> => Layer.succeed(Store)(makeStore(root))

export const StoreLive = storeAt(defaultRoot())
