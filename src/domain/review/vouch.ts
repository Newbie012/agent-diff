import type { Vouches } from "./model.ts"

export const isVouched = (vouches: Vouches, path: string, blob: string): boolean =>
  vouches[path] === blob

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
  vouches[part] === blob

export const vouchPart = (vouches: Vouches, part: string, blob: string): Vouches =>
  vouch(vouches, part, blob)
