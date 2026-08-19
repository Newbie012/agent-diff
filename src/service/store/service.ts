import { mkdir, readFile, appendFile, rename, stat, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { Context, Effect, Layer, Option, Schema } from "effect"
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
  defaultRoot,
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
    yield* Effect.tryPromise({
      try: () => writeFile(path, JSON.stringify(next), "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
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
    yield* Effect.tryPromise({
      try: () => writeFile(path, JSON.stringify(next, undefined, 2), "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  return { upgradeCheck, saveUpgradeCheck }
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

const keyOf = (worktreePath: string): Effect.Effect<string> =>
  Effect.promise(() =>
    Promise.all([repoOf(worktreePath), headOf(worktreePath)]).then(
      ([repo, head]) => `${repo}#${head}`,
    ),
  )

const wasKeyOf = (worktreePath: string): Effect.Effect<string> =>
  Effect.promise(() => headOf(worktreePath).then((head) => `${worktreePath}#${head}`))

const there = (path: string): Promise<boolean> =>
  stat(path).then(
    () => true,
    () => false,
  )

const adopted = new Set<string>()

const moved = (from: string, to: string): Promise<void> =>
  rename(from, to).catch(() => undefined)

const adopt = Effect.fn("Store.adopt")(function* (root: string, key: string, was: string) {
  const here = branchDir(root, key)
  if (yield* Effect.promise(() => there(here))) return key
  const older = branchDir(root, was)
  if (!(yield* Effect.promise(() => there(older)))) return key
  yield* Effect.promise(() => moved(older, here))
  return key
})

const keyIn = (root: string, worktreePath: string): Effect.Effect<string> =>
  Effect.gen(function* () {
    const key = yield* keyOf(worktreePath)
    const mark = `${root}#${key}`
    if (adopted.has(mark)) return key
    adopted.add(mark)
    const was = yield* wasKeyOf(worktreePath)
    return key === was ? key : yield* adopt(root, key, was)
  })

const answerOps = (root: string) => {
  const answer = Effect.fn("Store.answer")(function* (worktreePath: string, entry: StoredAnswer) {
    const key = yield* keyIn(root, worktreePath)
    const path = outboxPath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* Effect.tryPromise({
      try: () => appendFile(path, `${JSON.stringify(entry)}\n`, "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  const answers = Effect.fn("Store.answers")(function* (worktreePath: string) {
    const key = yield* keyIn(root, worktreePath)
    const path = outboxPath(root, key)
    const raw = yield* readOptional(path)
    return yield* Option.match(raw, {
      onNone: (): Effect.Effect<ReadonlyArray<StoredAnswer>, StoreUnreadable> => Effect.succeed([]),
      onSome: (text) => readLines(path, text, asAnswer),
    })
  })

  return { answer, answers }
}

const draftsOps = (root: string) => {
  const drafts = Effect.fn("Store.drafts")(function* (worktreePath: string) {
    const key = yield* keyIn(root, worktreePath)
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
    const key = yield* keyIn(root, worktreePath)
    const path = draftsPath(root, key)
    yield* ensureDir(branchDir(root, key))
    const body = JSON.stringify({ version: 1, drafts: next }, undefined, 2)
    yield* Effect.tryPromise({
      try: () => writeFile(path, body, "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  return { drafts, saveDrafts }
}

const layersOps = (root: string) => {
  const layers = Effect.fn("Store.layers")(function* (worktreePath: string) {
    const key = yield* keyIn(root, worktreePath)
    const path = layersPath(root, key)
    const raw = yield* readOptional(path)
    if (Option.isNone(raw)) return Option.none<StoredLayers>()
    return Option.some(yield* parseLayers(path, raw.value))
  })

  const saveLayers = Effect.fn("Store.saveLayers")(function* (
    worktreePath: string,
    next: StoredLayers,
  ) {
    const key = yield* keyIn(root, worktreePath)
    const path = layersPath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* Effect.tryPromise({
      try: () => writeFile(path, JSON.stringify(next, undefined, 2), "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  return { layers, saveLayers }
}

const inboxOps = (root: string) => {
  const submit = Effect.fn("Store.submit")(function* (worktreePath: string, batch: Batch) {
    const key = yield* keyIn(root, worktreePath)
    const path = inboxPath(root, key)
    yield* ensureDir(branchDir(root, key))
    yield* Effect.tryPromise({
      try: () => appendFile(path, `${JSON.stringify(batch)}\n`, "utf8"),
      catch: (cause) => new StoreUnwritable({ path, reason: String(cause) }),
    })
  })

  const inbox = Effect.fn("Store.inbox")(function* (worktreePath: string) {
    const key = yield* keyIn(root, worktreePath)
    const path = inboxPath(root, key)
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
    const key = yield* keyIn(root, worktreePath)
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
    const key = yield* keyIn(root, worktreePath)
    const path = statePath(root, key)
    yield* ensureDir(branchDir(root, key))
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
  const talk = answerOps(root)
  const cursors = cursorOps(state, inbox, talk.answers)
  return {
    root,
    branchAt: (worktreePath: string) => Effect.promise(() => headOf(worktreePath)),
    submit,
    inbox,
    state,
    saveState,
    saveReport: reportOps(root),
    ...settingsOps(root),
    ...upgradeOps(root),
    ...talk,
    ...layersOps(root),
    ...draftsOps(root),
    ...cursors,
  }
}

export const storeAt = (root: string): Layer.Layer<Store> => Layer.succeed(Store)(makeStore(root))

export const StoreLive = storeAt(defaultRoot())
