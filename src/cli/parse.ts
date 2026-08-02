import { Effect, Option } from "effect"
import { MissingOption } from "./error.ts"

export type Options = Readonly<Record<string, string>>

export const optionsFrom = (argv: ReadonlyArray<string>): Options => {
  const options: Record<string, string> = {}
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === undefined || !token.startsWith("--")) continue
    const next = argv[index + 1]
    options[token.slice(2)] = next === undefined || next.startsWith("--") ? "true" : next
  }
  return options
}

export const required = Effect.fn("Cli.required")(function* (options: Options, name: string) {
  const value = Option.fromNullishOr(options[name])
  return yield* Option.match(value, {
    onNone: () => new MissingOption({ option: name }),
    onSome: Effect.succeed,
  })
})

export const numeric = Effect.fn("Cli.numeric")(function* (options: Options, name: string) {
  const raw = yield* required(options, name)
  const parsed = Number(raw)
  return yield* Number.isFinite(parsed)
    ? Effect.succeed(parsed)
    : new MissingOption({ option: name })
})
