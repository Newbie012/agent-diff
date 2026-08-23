import { existsSync, readFileSync, realpathSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Option } from "effect"
import { InitUnwritable } from "./error.ts"

const REACH = 5

export type Change = {
  readonly path: string
  readonly action: "create" | "update" | "unchanged"
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

const skillSource = (): string | undefined => {
  const here = dirname(fileURLToPath(import.meta.url))
  const climb = Array.from({ length: REACH }, (_, layer) => join(here, ...Array(layer).fill("..")))
  return climb.map((at) => join(at, "skills", "adiff", "SKILL.md")).find((path) => existsSync(path))
}

const shippedSkill = Effect.fn("Cli.shippedSkill")(function* () {
  const source = skillSource()
  return yield* source === undefined
    ? new InitUnwritable({ path: "skills/adiff/SKILL.md", reason: "not found beside this build" })
    : Effect.sync(() => readFileSync(source, "utf8"))
})

const SKILL_AT = join(".claude", "skills", "adiff", "SKILL.md")

export type SkillReport = { readonly changes: ReadonlyArray<Change> }

const refreshAt = Effect.fn("Cli.refreshAt")(function* (root: string, wanted: string) {
  const path = join(root, SKILL_AT)
  if (!existsSync(path)) return []
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
  const wanted = yield* shippedSkill()
  const seen = [...new Set(roots.map(settledRoot))]
  const found: Array<Change> = []
  for (const root of seen) found.push(...(yield* refreshAt(root, wanted)))
  return { changes: found } satisfies SkillReport
})
