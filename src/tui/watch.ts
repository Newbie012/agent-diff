import { mkdirSync, watch, type FSWatcher } from "node:fs"
import { join } from "node:path"
import { Cause, Data, Effect, Queue, Stream } from "effect"

const OUTBOX = "outbox.jsonl"
const SETTLE_MS = 120

export class WatchUnavailable extends Data.TaggedError("WatchUnavailable")<{
  readonly root: string
  readonly reason: string
}> {}

const answered = (name: string | null): boolean => name !== null && name.endsWith(OUTBOX)

const opened = (branches: string, queue: Queue.Queue<void, Cause.Done<void>>): FSWatcher => {
  mkdirSync(branches, { recursive: true })
  const watcher = watch(branches, { recursive: true }, (_event, name) => {
    if (answered(name)) Queue.offerUnsafe(queue, undefined)
  })
  watcher.on("error", () => undefined)
  return watcher
}

const holding = (branches: string, queue: Queue.Queue<void, Cause.Done<void>>) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => opened(branches, queue),
      catch: (cause) => new WatchUnavailable({ root: branches, reason: String(cause) }),
    }),
    (watcher) => Effect.sync(() => watcher.close()),
  )

export const answers = (root: string): Stream.Stream<void> =>
  Stream.callback<void>((queue) =>
    holding(join(root, "branches"), queue).pipe(
      Effect.catchTag("WatchUnavailable", () => Effect.void),
    ),
  ).pipe(Stream.debounce(SETTLE_MS))
