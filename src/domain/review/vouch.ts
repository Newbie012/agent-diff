import type { Vouches } from "./model.ts"

const SHORTEST_BLOB = 7

export const sameBlob = (left: string | undefined, right: string | undefined): boolean => {
  if (left === undefined || right === undefined) return false
  if (left === right) return true
  if (left.length < SHORTEST_BLOB || right.length < SHORTEST_BLOB) return false
  return left.startsWith(right) || right.startsWith(left)
}

export const isVouched = (vouches: Vouches, path: string, blob: string): boolean =>
  sameBlob(vouches[path], blob)

export const vouch = (vouches: Vouches, path: string, blob: string): Vouches => {
  if (isVouched(vouches, path, blob)) {
    const { [path]: _cleared, ...rest } = vouches
    return rest
  }
  return { ...vouches, [path]: blob }
}

export type Run = { readonly start: number; readonly end: number }

export const partOf = (path: string, runs: ReadonlyArray<Run>): string => {
  const said = [...runs]
    .toSorted((left, right) => left.start - right.start || left.end - right.end)
    .map((run) => `${run.start}-${run.end}`)
    .join(",")
  return `${path}@${said}`
}

export const isPartVouched = (vouches: Vouches, part: string, blob: string): boolean =>
  sameBlob(vouches[part], blob)

export const vouchPart = (vouches: Vouches, part: string, blob: string): Vouches =>
  vouch(vouches, part, blob)
