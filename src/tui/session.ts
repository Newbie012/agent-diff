import { readFile, writeFile } from "node:fs/promises"
import { Effect, Option } from "effect"
import type { TuiState } from "./model.ts"

export type Session = {
  readonly branchIndex: number
  readonly patchIndex: number
  readonly cursor: number
  readonly top: number
}

const parse = (raw: string): Option.Option<Session> => {
  const parsed = JSON.parse(raw) as Partial<Session>
  if (typeof parsed.branchIndex !== "number") return Option.none()
  return Option.some({
    branchIndex: parsed.branchIndex,
    patchIndex: parsed.patchIndex ?? 0,
    cursor: parsed.cursor ?? 0,
    top: parsed.top ?? 0,
  })
}

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
