export type Worktree = {
  readonly path: string
  readonly branch: string
  readonly head: string
  readonly base: string
  readonly detached: boolean
}

export type DiffStat = {
  readonly files: number
  readonly added: number
  readonly removed: number
}
