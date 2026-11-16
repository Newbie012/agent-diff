import { followed, type Patch } from "../patch/index.ts"
import type { Run } from "./vouch.ts"

export type Change =
  | { readonly kind: "none" }
  | { readonly kind: "all" }
  | { readonly kind: "lines"; readonly diff: Patch }

export const NO_CHANGE: Change = { kind: "none" }

export const EVERY_LINE: Change = { kind: "all" }

const UNBOUNDED = Number.MAX_SAFE_INTEGER

const SEPARATOR = "@"

export const pathOfPart = (part: string): string => {
  const at = part.lastIndexOf(SEPARATOR)
  return at === -1 ? part : part.slice(0, at)
}

export const runsOfPart = (part: string): ReadonlyArray<Run> => {
  const at = part.lastIndexOf(SEPARATOR)
  if (at === -1) return []
  return part
    .slice(at + 1)
    .split(",")
    .flatMap((said) => {
      const [start, end] = said.split("-").map(Number)
      return start === undefined || end === undefined || Number.isNaN(start) || Number.isNaN(end)
        ? []
        : [{ start, end }]
    })
}

const touches = (diff: Patch, run: Run): boolean => followed(diff, run, UNBOUNDED).outdated

export const leavesUntouched = (change: Change, runs: ReadonlyArray<Run>): boolean => {
  if (change.kind === "none") return true
  if (change.kind === "all" || runs.length === 0) return false
  return !runs.some((run) => touches(change.diff, run))
}
