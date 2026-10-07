import { mkdirSync, watch, type FSWatcher } from "node:fs"
import { createInterface } from "node:readline"
import { Context, Effect, Layer, Cause } from "effect"
import { BadRequest, NotServed } from "./error.ts"
import { failure } from "./report.ts"
import { optionsFrom, type Options } from "./parse.ts"
import { valuedIn } from "./catalog.ts"

export class Replies extends Context.Service<
  Replies,
  { readonly say: (line: string) => Effect.Effect<void> }
>()("adiff/Replies") {}

export const toStdout: Layer.Layer<Replies> = Layer.succeed(Replies)({
  say: (line) => Effect.sync(() => void process.stdout.write(`${line}\n`)),
})

const NOT_SERVED: ReadonlySet<string> = new Set(["review open", "review pane", "resume", "upgrade", "serve"])

const SETTLE_MS = 120

type Answered = { readonly exit: number; readonly answer: unknown }

type Request = {
  readonly id: unknown
  readonly args?: ReadonlyArray<string>
  readonly watch?: ReadonlyArray<string>
  readonly unwatch?: boolean
}

export type Serving<E, R> = {
  readonly nameOf: (args: ReadonlyArray<string>) => string
  readonly run: (name: string, options: Options) => Effect.Effect<void, E, R | Replies>
  readonly folderOf: (options: Options) => Effect.Effect<string, E, R>
}

const refused = (cause: unknown): Answered => {
  const reported = failure(cause)
  return { exit: reported.exit, answer: JSON.parse(reported.line) as unknown }
}

const write = (line: unknown): void => {
  process.stdout.write(`${JSON.stringify(line)}\n`)
}

const answering = <E, R>(serving: Serving<E, R>, args: ReadonlyArray<string>) => {
  const name = serving.nameOf(args)
  if (NOT_SERVED.has(name)) return Effect.succeed(refused(new NotServed({ command: name })))
  const heard: Array<string> = []
  return serving.run(name, optionsFrom(args, valuedIn(name))).pipe(
    Effect.provideService(Replies, { say: (line) => Effect.sync(() => void heard.push(line)) }),
    Effect.map((): Answered => ({ exit: 0, answer: JSON.parse(heard.at(-1) ?? "{}") as unknown })),
    Effect.catchCause((cause) => Effect.succeed(refused(Cause.squash(cause)))),
  )
}

const settled = (folder: string, tell: () => void): FSWatcher => {
  mkdirSync(folder, { recursive: true })
  let timer: NodeJS.Timeout | undefined
  const watcher = watch(folder, () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(tell, SETTLE_MS)
  })
  watcher.on("error", () => undefined)
  return watcher
}

const watching = <E, R>(
  serving: Serving<E, R>,
  request: Request,
  watchers: Map<unknown, FSWatcher>,
) =>
  serving.folderOf(optionsFrom(request.watch ?? [], valuedIn("comment list"))).pipe(
    Effect.map((folder): Answered => {
      watchers.get(request.id)?.close()
      watchers.set(request.id, settled(folder, () => write({ id: request.id, event: "changed" })))
      return { exit: 0, answer: { ok: true, watching: folder } }
    }),
    Effect.catchCause((cause) => Effect.succeed(refused(Cause.squash(cause)))),
  )

const unwatching = (request: Request, watchers: Map<unknown, FSWatcher>): Answered => {
  watchers.get(request.id)?.close()
  watchers.delete(request.id)
  return { exit: 0, answer: { ok: true, watching: false } }
}

const readRequest = (line: string): Request | undefined => {
  try {
    const parsed: unknown = JSON.parse(line)
    if (typeof parsed !== "object" || parsed === null || !("id" in parsed)) return undefined
    return parsed
  } catch {
    return undefined
  }
}

const handled = <E, R>(
  serving: Serving<E, R>,
  line: string,
  watchers: Map<unknown, FSWatcher>,
): Effect.Effect<void, never, R> => {
  const request = readRequest(line)
  if (request === undefined) {
    return Effect.sync(() => write(refused(new BadRequest({ line }))))
  }
  const answer =
    request.unwatch === true
      ? Effect.succeed(unwatching(request, watchers))
      : request.watch !== undefined
        ? watching(serving, request, watchers)
        : answering(serving, request.args ?? [])
  return Effect.map(answer, (said) => write({ id: request.id, ...said }))
}

type Listening<R> = {
  readonly context: Context.Context<R>
  readonly watchers: Map<unknown, FSWatcher>
  readonly done: () => void
}

const listen = <E, R>(serving: Serving<E, R>, listening: Listening<R>): void => {
  const lines = createInterface({ input: process.stdin })
  const heard = (line: string): void => {
    if (line.trim().length === 0) return
    Effect.runForkWith(listening.context)(handled(serving, line, listening.watchers))
  }
  const closed = (): void => {
    for (const watcher of listening.watchers.values()) watcher.close()
    listening.done()
  }
  lines.on("line", heard)
  lines.on("close", closed)
}

export const serve = Effect.fn("Cli.serve")(function* <E, R>(serving: Serving<E, R>) {
  const context = yield* Effect.context<R>()
  const watchers = new Map<unknown, FSWatcher>()
  yield* Effect.callback<void>((resume) => {
    listen(serving, { context, watchers, done: () => resume(Effect.void) })
  })
})
