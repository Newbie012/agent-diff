import { watch, type FSWatcher } from "node:fs"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const OUTBOX = "outbox.jsonl"
const SETTLE_MS = 120

export type Watching = { readonly stop: () => void }

const answered = (name: string | null): boolean => name !== null && name.endsWith(OUTBOX)

export const watchAnswers = (root: string, arrived: () => void): Watching => {
  const branches = join(root, "branches")
  let timer: ReturnType<typeof setTimeout> | undefined
  let watcher: FSWatcher | undefined
  try {
    mkdirSync(branches, { recursive: true })
    watcher = watch(branches, { recursive: true }, (_event, name) => {
      if (!answered(name)) return
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(arrived, SETTLE_MS)
    })
    watcher.on("error", () => undefined)
  } catch {
    watcher = undefined
  }
  return {
    stop: () => {
      if (timer !== undefined) clearTimeout(timer)
      watcher?.close()
    },
  }
}
