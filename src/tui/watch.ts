import { mkdirSync, watch, type FSWatcher } from "node:fs"
import { join } from "node:path"
import { Data, Effect, Queue, Stream, type Cause } from "effect"

const OUTBOX = "outbox.jsonl"
const FILED: ReadonlyArray<string> = ["inbox.jsonl", "state.json"]
const SETTLE_MS = 120

export class WatchUnavailable extends Data.TaggedError("WatchUnavailable")<{
  readonly root: string
  readonly reason: string
}> {}

type Wanted = (name: string) => boolean

const answered: Wanted = (name) => name.endsWith(OUTBOX)

const filed: Wanted = (name) => FILED.some((file) => name.endsWith(file))

const opened = (branches: string, wanted: Wanted, queue: Queue.Queue<void, Cause.Done>): FSWatcher => {
  mkdirSync(branches, { recursive: true })
  const watcher = watch(branches, { recursive: true }, (_event, name) => {
    if (name !== null && wanted(name)) Queue.offerUnsafe(queue, undefined)
  })
  watcher.on("error", () => undefined)
  return watcher
}

const holding = (branches: string, wanted: Wanted, queue: Queue.Queue<void, Cause.Done>) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => opened(branches, wanted, queue),
      catch: (cause) => new WatchUnavailable({ root: branches, reason: String(cause) }),
    }),
    (watcher) => Effect.sync(() => watcher.close()),
  )

const changesTo = (root: string, wanted: Wanted): Stream.Stream<void> =>
  Stream.callback<void>((queue) =>
    holding(join(root, "branches"), wanted, queue).pipe(
      Effect.catchTag("WatchUnavailable", () => Effect.void),
    ),
  ).pipe(Stream.debounce(SETTLE_MS))

export const answers = (root: string): Stream.Stream<void> => changesTo(root, answered)

export const filings = (root: string): Stream.Stream<void> => changesTo(root, filed)
