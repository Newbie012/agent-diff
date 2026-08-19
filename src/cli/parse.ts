import { Effect, Option } from "effect"
import { BadOption, MissingOption, UnknownOption } from "./error.ts"

export type Options = Readonly<Record<string, string>>

const FLAG = /^--(?<name>[^=]+)(?:=(?<value>[\s\S]*))?$/

type Taken = { readonly options: Record<string, string>; readonly held: string | undefined }

const flagOn = (taken: Taken, token: string, valued: ReadonlySet<string>): Taken => {
  const found = FLAG.exec(token)?.groups
  if (found === undefined) return taken
  const name = found["name"] ?? ""
  const given = found["value"]
  if (given !== undefined) return { options: { ...taken.options, [name]: given }, held: undefined }
  if (valued.has(name)) return { options: taken.options, held: name }
  return { options: { ...taken.options, [name]: "true" }, held: undefined }
}

const tokenOn = (taken: Taken, token: string, valued: ReadonlySet<string>): Taken =>
  taken.held === undefined
    ? flagOn(taken, token, valued)
    : { options: { ...taken.options, [taken.held]: token }, held: undefined }

export const optionsFrom = (
  argv: ReadonlyArray<string>,
  valued: ReadonlySet<string> = new Set(),
): Options => {
  const taken = argv.reduce<Taken>((held, token) => tokenOn(held, token, valued), {
    options: {},
    held: undefined,
  })
  return taken.held === undefined ? taken.options : { ...taken.options, [taken.held]: "" }
}

export const onlyKnown = (
  options: Options,
  known: ReadonlySet<string>,
): Effect.Effect<Options, UnknownOption> => {
  const strange = Object.keys(options).find((name) => !known.has(name))
  return strange === undefined
    ? Effect.succeed(options)
    : Effect.fail(new UnknownOption({ option: strange, known: [...known].toSorted() }))
}

export const oneOf = <A extends string>(
  options: Options,
  name: string,
  allowed: ReadonlyArray<A>,
  byDefault: A,
): Effect.Effect<A, BadOption> => {
  const given = options[name]
  if (given === undefined) return Effect.succeed(byDefault)
  const found = allowed.find((one) => one === given)
  return found === undefined
    ? Effect.fail(new BadOption({ option: name, given, allowed }))
    : Effect.succeed(found)
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
  return yield* Number.isInteger(parsed) && parsed >= 1
    ? Effect.succeed(parsed)
    : new BadOption({ option: name, given: raw, allowed: ["a whole number of 1 or more"] })
})
