import { existsSync, lstatSync, realpathSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { Effect, Option } from "effect"
import { InitUnwritable } from "./error.ts"
import { SHIPPED_SKILL } from "./shipped-skill.ts"

export type Change = {
  readonly path: string
  readonly action: "create" | "update" | "unchanged" | "linked"
}

const readAt = Effect.fn("Cli.readAt")(function* (path: string) {
  const found = yield* Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: () => new InitUnwritable({ path, reason: "unreadable" }),
  }).pipe(Effect.option)
  return found
})

const writeAt = Effect.fn("Cli.writeAt")(function* (path: string, text: string) {
  yield* Effect.tryPromise({
    try: () => mkdir(dirname(path), { recursive: true }).then(() => writeFile(path, text, "utf8")),
    catch: (cause) => new InitUnwritable({ path, reason: String(cause) }),
  })
})

const SKILL_AT = join(".claude", "skills", "adiff", "SKILL.md")

export type SkillReport = { readonly changes: ReadonlyArray<Change> }

const isLink = (path: string): boolean => {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}

const refreshAt = Effect.fn("Cli.refreshAt")(function* (root: string, wanted: string) {
  const path = join(root, SKILL_AT)
  if (!existsSync(path)) return []
  if (isLink(path)) return [{ path, action: "linked" } satisfies Change]
  const current = yield* readAt(path)
  const held = Option.getOrUndefined(current)
  if (held === wanted) return [{ path, action: "unchanged" } satisfies Change]
  yield* writeAt(path, wanted)
  return [{ path, action: "update" } satisfies Change]
})

const settledRoot = (root: string): string => {
  try {
    return realpathSync(root)
  } catch {
    return root
  }
}

export const refreshSkill = Effect.fn("Cli.refreshSkill")(function* (
  roots: ReadonlyArray<string>,
) {
  const seen = [...new Set(roots.map(settledRoot))]
  const found: Array<Change> = []
  for (const root of seen) found.push(...(yield* refreshAt(root, SHIPPED_SKILL)))
  return { changes: found } satisfies SkillReport
})
