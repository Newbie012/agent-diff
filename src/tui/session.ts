import { readFile, writeFile } from "node:fs/promises"
import type { TuiState } from "./model.ts"

export type Session = {
  readonly branchIndex: number
  readonly patchIndex: number
  readonly cursor: number
  readonly top: number
}

export const readSession = async (path: string): Promise<Session | undefined> => {
  const raw = await readFile(path, "utf8").catch(() => undefined)
  if (raw === undefined) return undefined
  const parsed = JSON.parse(raw) as Partial<Session>
  if (typeof parsed.branchIndex !== "number") return undefined
  return {
    branchIndex: parsed.branchIndex,
    patchIndex: parsed.patchIndex ?? 0,
    cursor: parsed.cursor ?? 0,
    top: parsed.top ?? 0,
  }
}

export const sessionOf = (state: TuiState): Session => ({
  branchIndex: state.branchIndex,
  patchIndex: state.patchIndex,
  cursor: state.cursor,
  top: state.top,
})

export const writeSession = (path: string, session: Session): Promise<void> =>
  writeFile(path, JSON.stringify(session), "utf8").catch(() => undefined)
