import { mkdir, readFile, appendFile, writeFile } from "node:fs/promises"
import { Context, Effect, Layer, Option, Schema } from "effect"
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
import * as Wire from "./schema.ts"
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

const damaged = (path: string) => (reason: unknown) =>
  new StoreUnreadable({ path, reason: String(reason) })

const jsonOf = (path: string, raw: string): Effect.Effect<unknown, StoreUnreadable> =>
  Effect.try({ try: (): unknown => JSON.parse(raw), catch: damaged(path) })

const decoded = <A, I>(schema: Schema.Codec<A, I>) => {
  const decode = Schema.decodeUnknownEffect(schema)
  return (path: string, value: unknown): Effect.Effect<A, StoreUnreadable> =>
    Effect.mapError(decode(value), damaged(path))
}

const asSettings = decoded(Wire.Settings)
const asBatch = decoded(Wire.Batch)
const asAnswer = decoded(Wire.StoredAnswer)
const asState = decoded(Wire.BranchState)
const asLayers = decoded(Wire.StoredLayers)

const linesOf = (raw: string): ReadonlyArray<string> =>
  raw.split("\n").filter((line) => line.trim().length > 0)

const readLines = <A>(
  path: string,
  raw: string,
  as: (path: string, value: unknown) => Effect.Effect<A, StoreUnreadable>,
): Effect.Effect<ReadonlyArray<A>, StoreUnreadable> =>
  Effect.forEach(linesOf(raw), (line) =>
    jsonOf(path, line).pipe(Effect.flatMap((value) => as(path, value))),
  )

const parseSettings = Effect.fn("Store.parseSettings")(function* (path: string, raw: string) {
  const value = yield* jsonOf(path, raw)
  return yield* asSettings(path, value)
})

const parseState = Effect.fn("Store.parseState")(function* (path: string, raw: string) {
  const value = yield* jsonOf(path, raw)
  const held = yield* asState(path, value)
  return { ...emptyBranchState, ...held } satisfies BranchState
})

const parseLayers = Effect.fn("Store.parseLayers")(function* (path: string, raw: string) {
  const value = yield* jsonOf(path, raw)
  const held = yield* asLayers(path, value)
  return { ...held, parent: held.parent } satisfies StoredLayers
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
    const path = settingsPath(root)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<Settings, StoreUnreadable> => Effect.succeed({}),
      onSome: (text) => parseSettings(path, text),
    })
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
    const path = outboxPath(root, worktreePath)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<ReadonlyArray<StoredAnswer>, StoreUnreadable> => Effect.succeed([]),
      onSome: (text) => readLines(path, text, asAnswer),
    })
  })

  return { answer, answers }
}

const layersOps = (root: string) => {
  const layers = Effect.fn("Store.layers")(function* (worktreePath: string) {
    const path = layersPath(root, worktreePath)
    const raw = yield* readOptional(path)
    if (Option.isNone(raw)) return Option.none<StoredLayers>()
    return Option.some(yield* parseLayers(path, raw.value))
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

const inboxOps = (root: string) => {
  const submit = Effect.fn("Store.submit")(function* (worktreePath: string, batch: Batch) {
    const path = inboxPath(root, worktreePath)
    yield* ensureDir(branchDir(root, worktreePath))
    yield* Effect.tryPromise({
      try: () => appendFile(path, `${JSON.stringify(batch)}\n`, "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  const inbox = Effect.fn("Store.inbox")(function* (worktreePath: string) {
    const path = inboxPath(root, worktreePath)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable> => Effect.succeed([]),
      onSome: (text) => readLines(path, text, asBatch),
    })
  })

  return { submit, inbox }
}

const stateOps = (root: string) => {
  const state = Effect.fn("Store.state")(function* (worktreePath: string) {
    const path = statePath(root, worktreePath)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<BranchState, StoreUnreadable> => Effect.succeed(emptyBranchState),
      onSome: (text) => parseState(path, text),
    })
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

  return { state, saveState }
}

const makeStore = (root: string): Shape => {
  const { submit, inbox } = inboxOps(root)
  const { state, saveState } = stateOps(root)
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
