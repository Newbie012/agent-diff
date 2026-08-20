import { expect as plain } from "@effect/vitest"
import { tracing } from "./trace.ts"
import type { Bounds } from "./trace.ts"

const SAID: Readonly<Record<string, string>> = {
  toBe: "is",
  toEqual: "is",
  toContain: "contains",
  toMatch: "matches",
  toBeGreaterThan: "is more than",
  toBeLessThan: "is fewer than",
  toHaveLength: "has",
  toBeUndefined: "is not there",
  toBeDefined: "is there",
  toBeTruthy: "holds",
  toBeFalsy: "does not hold",
}

const shortly = (value: unknown): string => {
  if (typeof value === "string") return value.length > 60 ? `${value.slice(0, 57)}…` : value
  if (Array.isArray(value)) return value.map(shortly).join(", ")
  return String(value)
}

export type Subject = {
  readonly noun: string
  readonly where?: Bounds
}

export type NoteCheck = (does: string, about: Subject | undefined) => void

let noting: NoteCheck | undefined
let subject: Subject | undefined

export const noteChecksWith = (note: NoteCheck | undefined): void => {
  noting = note
}

export const noteSubject = (about: Subject): void => {
  subject = about
}

const phrase = (matcher: string, negated: boolean, args: ReadonlyArray<unknown>): string => {
  const many = Array.isArray(args[0]) && (args[0] as ReadonlyArray<unknown>).length !== 1
  const spelt = SAID[matcher] ?? matcher
  const verb = many && spelt === "is" ? "are" : spelt
  const said = args.length === 0 ? "" : ` ${shortly(args[0])}`
  return `${negated ? "not " : ""}${verb}${said}`.trim()
}

const wrapped = (held: object, negated: boolean): object =>
  new Proxy(held, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver) as unknown
      if (prop === "not") return wrapped(value as object, !negated)
      if (typeof value !== "function") return value
      return (...args: ReadonlyArray<unknown>) => {
        noting?.(phrase(String(prop), negated, args), subject)
        subject = undefined
        return Reflect.apply(value as (...rest: ReadonlyArray<unknown>) => unknown, target, args)
      }
    },
  })

export const expect = (
  tracing()
    ? new Proxy(plain as unknown as (...args: ReadonlyArray<unknown>) => unknown, {
        apply(target, self, args) {
          return wrapped(Reflect.apply(target, self, args) as object, false)
        },
      })
    : plain
) as typeof plain
