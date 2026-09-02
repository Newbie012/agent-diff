import { readFile, writeFile } from "node:fs/promises"
import { Effect, Option, Schema } from "effect"
import { SessionUnreadable, SessionUnwritable } from "./error.ts"
import type { TuiState } from "./state.ts"

const zero = Schema.withDecodingDefaultKey<typeof Schema.Number>(Effect.succeed(0))

const Held = Schema.Struct({
  branchIndex: Schema.Number,
  patchIndex: Schema.Number.pipe(zero),
  cursor: Schema.Number.pipe(zero),
  top: Schema.Number.pipe(zero),
})

export type Session = typeof Held.Type

const decode = Schema.decodeUnknownOption(Held)

const jsonOf = Option.liftThrowable((raw: string): unknown => JSON.parse(raw))

const parse = (raw: string): Option.Option<Session> => Option.flatMap(jsonOf(raw), decode)

const missing = Effect.succeed(Option.none<string>())

const held = (path: string): Effect.Effect<Option.Option<string>> =>
  Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => new SessionUnreadable({ path, reason: String(cause) }),
  }).pipe(Effect.map(Option.some), Effect.catchTag("SessionUnreadable", () => missing))

export const readSession = Effect.fn("Tui.readSession")(function* (path: string) {
  const raw = yield* held(path)
  return Option.flatMap(raw, parse)
})

export const sessionOf = (state: TuiState): Session => ({
  branchIndex: state.branchIndex,
  patchIndex: state.patchIndex,
  cursor: state.cursor,
  top: state.top,
})

export const writeSession = Effect.fn("Tui.writeSession")(function* (
  path: string,
  session: Session,
) {
  yield* Effect.tryPromise({
    try: () => writeFile(path, JSON.stringify(session), "utf8"),
    catch: (cause) => new SessionUnwritable({ path, reason: String(cause) }),
  }).pipe(Effect.catchTag("SessionUnwritable", () => Effect.void))
})
