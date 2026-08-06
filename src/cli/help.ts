import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { catalog, findCommand, type CommandSpec } from "./catalog.ts"

const NAME_ROOM = 18
const REACH = 5

const manifest = (): string | undefined => {
  const here = dirname(fileURLToPath(import.meta.url))
  const climb = Array.from({ length: REACH }, (_, layer) => join(here, ...Array(layer).fill("..")))
  return climb.map((at) => join(at, "package.json")).find((path) => existsSync(path))
}

export const version = (): string => {
  const path = manifest()
  if (path === undefined) return "unknown"
  const raw = readFileSync(path, "utf8")
  return (JSON.parse(raw) as { version?: string }).version ?? "unknown"
}

const line = (command: CommandSpec): string =>
  `  ${command.name.padEnd(NAME_ROOM)}${command.about}`

export const banner = (): string =>
  [
    `adiff ${version()}`,
    "",
    "Review the work an agent did in a git worktree, and hand your comments back.",
    "",
    "A reviewer opens the terminal:",
    "",
    "  adiff review open --repo .        read the diff, select lines, write comments",
    "",
    "An agent working in that worktree answers them:",
    "",
    "  adiff comment take --worktree . --wait 300    block until a comment arrives",
    "  adiff comment answer --worktree . --id <id> --body '…'",
    "  adiff layers set --worktree . --json -        publish the reading order",
    "",
    "Every comment carries an id, and an answer goes back to the reviewer under it.",
    "",
    "adiff --help lists every command. adiff describe answers the same as JSON,",
    "and describe --command 'comment take' answers for one.",
  ].join("\n")

export const help = (): string =>
  ["adiff, for reviewing an agent's work in a worktree", "", "Commands:", ...catalog.map(line), "", "Run `adiff help <command>` for its options."].join("\n")

const option = (spec: CommandSpec["options"][number]): string =>
  `  --${spec.name.padEnd(NAME_ROOM - 2)}${spec.about}${spec.required ? " (required)" : ""}`

export const helpFor = (name: string): string | undefined => {
  const command = findCommand(name)
  if (command === undefined) return undefined
  const options = command.options.length === 0 ? [] : ["", "Options:", ...command.options.map(option)]
  return [`adiff ${command.name}`, "", command.about, ...options].join("\n")
}
