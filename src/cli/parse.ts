import { Effect, Option } from "effect"
import { WAIT_MOST } from "./catalog.ts"
import { BadOption, MissingOption, UnknownOption } from "./error.ts"

export type Options = Readonly<Record<string, string>>

const FLAG = /^--(?<name>[^=]+)(?:=(?<value>[\s\S]*))?$/

type Taken = { readonly options: Record<string, string>; readonly held: string | undefined }

const REPEATED: ReadonlySet<string> = new Set(["choice"])

const MANY = "\n"

const withValue = (options: Record<string, string>, name: string, value: string): Record<string, string> => {
  const before = options[name]
  if (before === undefined || !REPEATED.has(name)) return { ...options, [name]: value }
  return { ...options, [name]: `${before}${MANY}${value}` }
}

const flagOn = (taken: Taken, token: string, valued: ReadonlySet<string>): Taken => {
  const found = FLAG.exec(token)?.groups
  if (found === undefined) return taken
  const name = found["name"] ?? ""
  const value = found["value"]
  if (value !== undefined) return { options: withValue(taken.options, name, value), held: undefined }
  if (valued.has(name)) return { options: taken.options, held: name }
  return { options: { ...taken.options, [name]: "true" }, held: undefined }
}

const tokenOn = (taken: Taken, token: string, valued: ReadonlySet<string>): Taken =>
  taken.held === undefined
    ? flagOn(taken, token, valued)
    : { options: withValue(taken.options, taken.held, token), held: undefined }

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

const WHOLE = "all"

export const around = Effect.fn("Cli.around")(function* (options: Options, name: string) {
  const raw = options[name]
  if (raw === undefined) return undefined
  if (raw === WHOLE) return WHOLE
  const parsed = Number(raw)
  return yield* Number.isInteger(parsed) && parsed >= 0
    ? Effect.succeed(parsed)
    : new BadOption({ option: name, given: raw, allowed: ["a whole number of 0 or more", WHOLE] })
})

export const seconds = Effect.fn("Cli.seconds")(function* (options: Options, name: string) {
  const raw = options[name]
  if (raw === undefined) return 0
  const asked = Number(raw)
  return yield* Number.isInteger(asked) && asked >= 1 && asked <= WAIT_MOST
    ? Effect.succeed(asked)
    : new BadOption({
        option: name,
        given: raw,
        allowed: [`a whole number of seconds from 1 to ${WAIT_MOST}`],
      })
})

export const many = (options: Options, name: string): ReadonlyArray<string> => {
  const raw = options[name]
  return raw === undefined ? [] : raw.split(MANY)
}

const CHOICES_FEWEST = 2

const CHOICES_MOST = 4

export const choices = Effect.fn("Cli.choices")(function* (options: Options, name: string) {
  const offered = many(options, name).map((choice) => choice.trim())
  if (offered.length === 0) return offered
  const fits = offered.length >= CHOICES_FEWEST && offered.length <= CHOICES_MOST
  return yield* fits && offered.every((choice) => choice.length > 0)
    ? Effect.succeed(offered)
    : new BadOption({
        option: name,
        given: offered.join(" | "),
        allowed: [`${CHOICES_FEWEST} to ${CHOICES_MOST} choices, none of them empty`],
      })
})

export const oneLine = Effect.fn("Cli.oneLine")(function* (options: Options, name: string) {
  const said = (yield* required(options, name)).trim()
  return yield* said.length > 0 && !said.includes("\n")
    ? Effect.succeed(said)
    : new BadOption({ option: name, given: said, allowed: ["one line of text, not empty"] })
})
