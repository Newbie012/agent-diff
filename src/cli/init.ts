import { existsSync, readFileSync, realpathSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { Effect, Option } from "effect"
import { InitUnwritable } from "./error.ts"

const BEGIN = "<!-- adiff:begin -->"
const END = "<!-- adiff:end -->"
const REACH = 5

export type Change = {
  readonly path: string
  readonly action: "create" | "append" | "update" | "unchanged"
}

export type InitReport = {
  readonly wrote: boolean
  readonly changes: ReadonlyArray<Change>
}

export type InitRequest = {
  readonly repo: string
  readonly write: boolean
  readonly skill: boolean
}

const INSTRUCTIONS = [
  BEGIN,
  "## Review",
  "",
  "Review of work in this repository happens in adiff. Before you say you are done, run",
  "`adiff comment take --worktree . --wait 300` in the background and handle what arrives.",
  "Answer a comment with `adiff comment answer --worktree . --id <id> --body <text>`.",
  "When you hand work over, say it is ready and name the command that opens the review:",
  "`adiff review open --repo <repo>`, or `adiff review pane --repo <repo>` to open it alongside.",
  "Publish a reading order with `adiff layers set` only when you are asked for one.",
  "`adiff --help` lists the rest, and `adiff describe` answers the same as JSON.",
  END,
].join("\n")

const IMPORT = [BEGIN, "@AGENTS.md", END].join("\n")

const blockIn = (text: string): Option.Option<string> => {
  const opens = text.indexOf(BEGIN)
  const closes = text.indexOf(END, opens)
  return opens === -1 || closes === -1
    ? Option.none()
    : Option.some(text.slice(opens, closes + END.length))
}

const replaced = (text: string, block: string, wanted: string): string =>
  text.replace(block, wanted)

const appended = (text: string, wanted: string): string =>
  text.endsWith("\n") ? `${text}\n${wanted}\n` : `${text}\n\n${wanted}\n`

type Plan = { readonly action: Change["action"]; readonly next: string }

const planFor = (current: Option.Option<string>, wanted: string): Plan => {
  const text = Option.getOrUndefined(current)
  if (text === undefined) return { action: "create", next: `${wanted}\n` }
  const found = blockIn(text)
  if (Option.isNone(found)) return { action: "append", next: appended(text, wanted) }
  return found.value === wanted
    ? { action: "unchanged", next: text }
    : { action: "update", next: replaced(text, found.value, wanted) }
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

const settle = Effect.fn("Cli.settle")(function* (
  root: string,
  name: string,
  wanted: string,
  write: boolean,
) {
  const path = join(root, name)
  const current = yield* readAt(path)
  const plan = planFor(current, wanted)
  if (write && plan.action !== "unchanged") yield* writeAt(path, plan.next)
  return { path: name, action: plan.action } satisfies Change
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

const settleSkill = Effect.fn("Cli.settleSkill")(function* (root: string, write: boolean) {
  const name = join(".claude", "skills", "adiff", "SKILL.md")
  const wanted = yield* shippedSkill()
  const current = yield* readAt(join(root, name))
  const action = Option.match(current, {
    onNone: (): Change["action"] => "create",
    onSome: (text) => (text === wanted ? "unchanged" : "update"),
  })
  if (write && action !== "unchanged") yield* writeAt(join(root, name), wanted)
  return { path: name, action } satisfies Change
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

export const initRepository = Effect.fn("Cli.initRepository")(function* (request: InitRequest) {
  const instructions = yield* settle(request.repo, "AGENTS.md", INSTRUCTIONS, request.write)
  const memory = yield* settle(request.repo, "CLAUDE.md", IMPORT, request.write)
  const skill = request.skill ? [yield* settleSkill(request.repo, request.write)] : []
  return { wrote: request.write, changes: [instructions, memory, ...skill] } satisfies InitReport
})
