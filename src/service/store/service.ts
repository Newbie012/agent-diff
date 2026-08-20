import { mkdir, readFile, appendFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Cache, Context, Effect, Layer, Option, Schedule, Schema } from "effect"
import { StoreUnreadable, StoreUnwritable } from "./error.ts"
import {
  emptyBranchState,
  type Batch,
  type BranchState,
  type StoredAnswer,
  type StoredComment,
  type Settings,
  type StoredDraft,
  type StoredLayers,
  type UpgradeCheck,
} from "./model.ts"
import * as Wire from "./schema.ts"
import {
  branchDir,
  inboxPath,
  outboxPath,
  reportPath,
  reportsDir,
  settingsPath,
  statePath,
  draftsPath,
  layersPath,
  upgradePath,
} from "./paths.ts"

type Shape = {
  readonly root: string
  readonly branchAt: (worktreePath: string) => Effect.Effect<string>
  readonly submit: (worktreePath: string, batch: Batch) => Effect.Effect<void, StoreUnwritable>
  readonly inbox: (worktreePath: string) => Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable>
  readonly state: (worktreePath: string) => Effect.Effect<BranchState, StoreUnreadable>
  readonly saveState: (
    worktreePath: string,
    state: BranchState,
  ) => Effect.Effect<void, StoreUnwritable>
  readonly changeState: (
    worktreePath: string,
    change: (was: BranchState) => BranchState,
  ) => Effect.Effect<void, StoreUnreadable | StoreUnwritable>
  readonly saveReport: (stamp: string, text: string) => Effect.Effect<string, StoreUnwritable>
  readonly settings: Effect.Effect<Settings, StoreUnreadable>
  readonly saveSettings: (next: Settings) => Effect.Effect<void, StoreUnwritable>
  readonly upgradeCheck: Effect.Effect<UpgradeCheck, StoreUnreadable>
  readonly saveUpgradeCheck: (next: UpgradeCheck) => Effect.Effect<void, StoreUnwritable>
  readonly layers: (
    worktreePath: string,
  ) => Effect.Effect<Option.Option<StoredLayers>, StoreUnreadable>
  readonly saveLayers: (
    worktreePath: string,
    layers: StoredLayers,
  ) => Effect.Effect<void, StoreUnwritable>
  readonly drafts: (
    worktreePath: string,
  ) => Effect.Effect<ReadonlyArray<StoredDraft>, StoreUnreadable>
  readonly saveDrafts: (
    worktreePath: string,
    drafts: ReadonlyArray<StoredDraft>,
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

const unwritable = (path: string) => (reason: unknown) =>
  new StoreUnwritable({ path, reason: String(reason) })

const wrote = (path: string, body: string): Effect.Effect<void, StoreUnwritable> =>
  Effect.tryPromise({ try: () => writeFile(path, body, "utf8"), catch: unwritable(path) })

const added = (path: string, body: string): Effect.Effect<void, StoreUnwritable> =>
  Effect.tryPromise({ try: () => appendFile(path, `${body}\n`, "utf8"), catch: unwritable(path) })

const INDENT = 2
const DRAFTS_VERSION = 1

const encoded = <A, I>(schema: Schema.Codec<A, I>) => {
  const encode = Schema.encodeEffect(schema)
  return (path: string, value: A): Effect.Effect<I, StoreUnwritable> =>
    Effect.mapError(encode(value), unwritable(path))
}

const writes = <A, I>(schema: Schema.Codec<A, I>, space?: number) => {
  const encode = encoded(schema)
  return (path: string, value: A): Effect.Effect<void, StoreUnwritable> =>
    Effect.flatMap(encode(path, value), (wire) => wrote(path, JSON.stringify(wire, undefined, space)))
}

const appends = <A, I>(schema: Schema.Codec<A, I>) => {
  const encode = encoded(schema)
  return (path: string, value: A): Effect.Effect<void, StoreUnwritable> =>
    Effect.flatMap(encode(path, value), (wire) => added(path, JSON.stringify(wire)))
}

const writeSettings = writes(Wire.Settings)
const writeUpgradeCheck = writes(Wire.UpgradeCheck, INDENT)
const writeState = writes(Wire.BranchState, INDENT)
const writeLayers = writes(Wire.StoredLayers, INDENT)
const writeDrafts = writes(Wire.Drafts, INDENT)
const writeBatch = appends(Wire.Batch)
const writeAnswer = appends(Wire.StoredAnswer)

const asSettings = decoded(Wire.Settings)
const asUpgradeCheck = decoded(Wire.UpgradeCheck)
const asBatch = decoded(Wire.Batch)
const asAnswer = decoded(Wire.StoredAnswer)
const asState = decoded(Wire.BranchState)
const asLayers = decoded(Wire.StoredLayers)
const asDrafts = decoded(Wire.Drafts)

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

const parseUpgradeCheck = Effect.fn("Store.parseUpgradeCheck")(function* (path: string, raw: string) {
  const value = yield* jsonOf(path, raw)
  return yield* asUpgradeCheck(path, value)
})

const parseState = Effect.fn("Store.parseState")(function* (path: string, raw: string) {
  return yield* asState(path, yield* jsonOf(path, raw))
})

const parseLayers = Effect.fn("Store.parseLayers")(function* (path: string, raw: string) {
  return yield* asLayers(path, yield* jsonOf(path, raw))
})

type Reader = (worktreePath: string) => Effect.Effect<BranchState, StoreUnreadable>
type Inbox = (worktreePath: string) => Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable>
type Spoken = (worktreePath: string) => Effect.Effect<ReadonlyArray<StoredAnswer>, StoreUnreadable>

const cursorOps = (state: Reader, inbox: Inbox, spoken: Spoken) => {
  const take = Effect.fn("Store.take")(function* (worktreePath: string) {
    const batches = yield* inbox(worktreePath)
    const current = yield* state(worktreePath)
    const answered = new Set((yield* spoken(worktreePath)).map((entry) => entry.comment))
    const owed = (comment: StoredComment): boolean =>
      !answered.has(comment.id) &&
      !Object.hasOwn(current.settled, comment.id) &&
      !Object.hasOwn(current.removed, comment.id)
    return batches.flatMap((batch) => {
      const comments = batch.comments.filter(owed)
      return comments.length === 0 ? [] : [{ id: batch.id, at: batch.at, head: batch.head, comments }]
    })
  })

  return { take }
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
    yield* writeSettings(path, next)
  })

  return { settings, saveSettings }
}

const upgradeOps = (root: string) => {
  const upgradeCheck = Effect.gen(function* () {
    const path = upgradePath(root)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<UpgradeCheck, StoreUnreadable> => Effect.succeed({}),
      onSome: (text) => parseUpgradeCheck(path, text),
    })
  }).pipe(Effect.withSpan("Store.upgradeCheck"))

  const saveUpgradeCheck = Effect.fn("Store.saveUpgradeCheck")(function* (next: UpgradeCheck) {
    const path = upgradePath(root)
    yield* ensureDir(root)
    yield* writeUpgradeCheck(path, next)
  })

  return { upgradeCheck, saveUpgradeCheck }
}

const reportOps = (root: string) =>
  Effect.fn("Store.saveReport")(function* (stamp: string, text: string) {
    const path = reportPath(root, stamp)
    yield* ensureDir(reportsDir(root))
    yield* wrote(path, text)
    return path
  })

const HEAD_REF = /^ref:\s*refs\/heads\/(.+)$/

const gitDirOf = (worktreePath: string): Promise<string> =>
  readFile(join(worktreePath, ".git"), "utf8")
    .then((raw) => {
      const linked = raw.match(/^gitdir:\s*(.+)$/m)
      return linked?.[1] === undefined ? join(worktreePath, ".git") : linked[1].trim()
    })
    .catch(() => join(worktreePath, ".git"))

const headOf = (worktreePath: string): Promise<string> =>
  gitDirOf(worktreePath)
    .then((dir) => readFile(join(dir, "HEAD"), "utf8"))
    .then((raw) => {
      const named = raw.trim().match(HEAD_REF)
      return named?.[1] === undefined ? raw.trim() : named[1]
    })
    .catch(() => "")

const repoOf = (worktreePath: string): Promise<string> =>
  gitDirOf(worktreePath).then((dir) =>
    readFile(join(dir, "commondir"), "utf8")
      .then((raw) => resolve(dir, raw.trim()))
      .catch(() => dir),
  )

export const branchKeyOf = (worktreePath: string): Effect.Effect<string> =>
  Effect.map(
    Effect.all(
      [Effect.promise(() => repoOf(worktreePath)), Effect.promise(() => headOf(worktreePath))],
      { concurrency: 2 },
    ),
    ([repo, head]) => `${repo}#${head}`,
  )

const wasKeyOf = (worktreePath: string): Effect.Effect<string> =>
  Effect.promise(() => headOf(worktreePath).then((head) => `${worktreePath}#${head}`))

const there = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  )

const moved = (from: string, to: string): Promise<void> =>
  rename(from, to).catch(() => undefined)

const adopt = Effect.fn("Store.adopt")(function* (root: string, key: string, was: string) {
  const here = branchDir(root, key)
  if (yield* Effect.promise(() => there(here))) return
  const older = branchDir(root, was)
  if (!(yield* Effect.promise(() => there(older)))) return
  yield* Effect.promise(() => moved(older, here))
})

const SPLIT = "\u0000"

const ADOPT_SIZE = 256

const adopting = (root: string) =>
  Effect.fn("Store.adopting")(function* (mark: string) {
    const [key = "", worktreePath = ""] = mark.split(SPLIT)
    const was = yield* wasKeyOf(worktreePath)
    if (key !== was) yield* adopt(root, key, was)
    return key
  })

type Keys = Cache.Cache<string, string>

const keyIn = (adopted: Keys, worktreePath: string): Effect.Effect<string> =>
  Effect.flatMap(branchKeyOf(worktreePath), (key) =>
    Cache.get(adopted, `${key}${SPLIT}${worktreePath}`),
  )

const answerOps = (root: string, adopted: Keys) => {
  const answer = Effect.fn("Store.answer")(function* (worktreePath: string, entry: StoredAnswer) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = outboxPath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* writeAnswer(path, entry)
  })

  const answers = Effect.fn("Store.answers")(function* (worktreePath: string) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = outboxPath(root, key)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<ReadonlyArray<StoredAnswer>, StoreUnreadable> => Effect.succeed([]),
      onSome: (text) => readLines(path, text, asAnswer),
    })
  })

  return { answer, answers }
}

const draftsOps = (root: string, adopted: Keys) => {
  const drafts = Effect.fn("Store.drafts")(function* (worktreePath: string) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = draftsPath(root, key)
    const raw = yield* readOptional(path)
    if (Option.isNone(raw)) return [] as ReadonlyArray<StoredDraft>
    const value = yield* jsonOf(path, raw.value)
    const held = yield* asDrafts(path, value)
    return held.drafts
  })

  const saveDrafts = Effect.fn("Store.saveDrafts")(function* (
    worktreePath: string,
    next: ReadonlyArray<StoredDraft>,
  ) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = draftsPath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* writeDrafts(path, { version: DRAFTS_VERSION, drafts: next })
  })

  return { drafts, saveDrafts }
}

const layersOps = (root: string, adopted: Keys) => {
  const layers = Effect.fn("Store.layers")(function* (worktreePath: string) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = layersPath(root, key)
    const raw = yield* readOptional(path)
    if (Option.isNone(raw)) return Option.none<StoredLayers>()
    return Option.some(yield* parseLayers(path, raw.value))
  })

  const saveLayers = Effect.fn("Store.saveLayers")(function* (
    worktreePath: string,
    next: StoredLayers,
  ) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = layersPath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* writeLayers(path, next)
  })

  return { layers, saveLayers }
}

const inboxOps = (root: string, adopted: Keys) => {
  const submit = Effect.fn("Store.submit")(function* (worktreePath: string, batch: Batch) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = inboxPath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* writeBatch(path, batch)
  })

  const inbox = Effect.fn("Store.inbox")(function* (worktreePath: string) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = inboxPath(root, key)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<ReadonlyArray<Batch>, StoreUnreadable> => Effect.succeed([]),
      onSome: (text) => readLines(path, text, asBatch),
    })
  })

  return { submit, inbox }
}

const LOCK_TRIES = 60
const LOCK_WAIT_MS = 25
const LOCK_STALE_MS = 5000

const held = (path: string): Effect.Effect<void, StoreUnwritable> =>
  Effect.tryPromise({
    try: () => writeFile(path, `${process.pid}`, { flag: "wx" }),
    catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
  })

const stale = (path: string): Effect.Effect<boolean> =>
  Effect.promise(() =>
    stat(path).then(
      (found) => Date.now() - found.mtimeMs > LOCK_STALE_MS,
      () => false,
    ),
  )

const stolen = (path: string, cause: StoreUnwritable): Effect.Effect<void, StoreUnwritable> =>
  Effect.flatMap(stale(path), (old) =>
    old
      ? Effect.flatMap(Effect.promise(() => rm(path, { force: true })), () => held(path))
      : Effect.fail(cause),
  )

const taken = (path: string): Effect.Effect<void, StoreUnwritable> =>
  Effect.retry(
    held(path).pipe(Effect.catchTag("StoreUnwritable", (cause) => stolen(path, cause))),
    { times: LOCK_TRIES, schedule: Schedule.spaced(LOCK_WAIT_MS) },
  )

const freed = (path: string): Effect.Effect<void> =>
  Effect.promise(() => rm(path, { force: true }))

const stateOps = (root: string, adopted: Keys) => {
  const state = Effect.fn("Store.state")(function* (worktreePath: string) {
    const key = yield* keyIn(adopted, worktreePath)
    const path = statePath(root, key)
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
    const key = yield* keyIn(adopted, worktreePath)
    const path = statePath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* writeState(path, next)
  })

  const changeState = Effect.fn("Store.changeState")(function* (
    worktreePath: string,
    change: (was: BranchState) => BranchState,
  ) {
    const key = yield* keyIn(adopted, worktreePath)
    yield* ensureDir(branchDir(root, key))
    const lock = `${statePath(root, key)}.lock`
    yield* Effect.acquireUseRelease(taken(lock), () => under(worktreePath, change), () => freed(lock))
  })

  const under = Effect.fn("Store.under")(function* (
    worktreePath: string,
    change: (was: BranchState) => BranchState,
  ) {
    yield* saveState(worktreePath, change(yield* state(worktreePath)))
  })

  return { state, saveState, changeState }
}

const makeStore = (root: string, adopted: Keys): Shape => {
  const { submit, inbox } = inboxOps(root, adopted)
  const { state, saveState, changeState } = stateOps(root, adopted)
  const talk = answerOps(root, adopted)
  const cursors = cursorOps(state, inbox, talk.answers)
  return {
    root,
    branchAt: (worktreePath: string) => Effect.promise(() => headOf(worktreePath)),
    submit,
    inbox,
    state,
    saveState,
    changeState,
    saveReport: reportOps(root),
    ...settingsOps(root),
    ...upgradeOps(root),
    ...talk,
    ...layersOps(root, adopted),
    ...draftsOps(root, adopted),
    ...cursors,
  }
}

const madeStore = Effect.fn("Store.make")(function* (root: string) {
  const adopted = yield* Cache.make({ capacity: ADOPT_SIZE, lookup: adopting(root) })
  return makeStore(root, adopted)
})

export const storeAt = (root: string): Layer.Layer<Store> => Layer.effect(Store)(madeStore(root))
