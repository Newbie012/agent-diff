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
