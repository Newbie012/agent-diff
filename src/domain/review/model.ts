export type Vouches = Readonly<Record<string, string>>

export type VouchedFile = {
  readonly path: string
  readonly blob: string
}
