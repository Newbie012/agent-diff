import { readFile, writeFile } from "node:fs/promises"
import { Effect, Option, Schema } from "effect"
import type { TuiState } from "./model.ts"

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

const saved = (path: string, session: Session): Promise<void> =>
  writeFile(path, JSON.stringify(session), "utf8").catch(() => undefined)

const held = (path: string): Promise<Option.Option<string>> =>
  readFile(path, "utf8")
    .then((raw) => Option.some(raw))
    .catch(() => Option.none<string>())

export const readSession = Effect.fn("Tui.readSession")(function* (path: string) {
  const raw = yield* Effect.promise(() => held(path))
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
  yield* Effect.promise(() => saved(path, session))
})
