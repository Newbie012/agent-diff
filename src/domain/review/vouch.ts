import type { VouchedFile, Vouches } from "./model.ts"

export const isVouched = (vouches: Vouches, path: string, blob: string): boolean =>
  vouches[path] === blob

export const vouch = (vouches: Vouches, path: string, blob: string): Vouches => {
  if (isVouched(vouches, path, blob)) {
    const { [path]: _cleared, ...rest } = vouches
    return rest
  }
  return { ...vouches, [path]: blob }
}

export const vouchedCount = (vouches: Vouches, files: ReadonlyArray<VouchedFile>): number =>
  files.filter((file) => isVouched(vouches, file.path, file.blob)).length
