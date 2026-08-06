import manifest from "../../package.json" with { type: "json" }
import { catalog, findCommand, groups, verbsUnder, type CommandSpec, type OptionSpec } from "./catalog.ts"

const NAME_ROOM = 18
const OPTION_ROOM = 24

export const version = (): string => manifest.version

const opening = (about: string): string => about.split(". ")[0] ?? about

const line = (command: CommandSpec): string =>
  `  ${command.name.padEnd(NAME_ROOM)}${opening(command.about)}`

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
    "  adiff layers set --worktree . --json -        publish a reading order, when asked",
    "",
    "Every comment carries an id, and an answer goes back to the reviewer under it.",
    "",
    "adiff --help lists every command. adiff describe answers the same as JSON,",
    "and describe --command 'comment take' answers for one.",
  ].join("\n")

const under = (group: string): ReadonlyArray<string> => [
  group,
  ...catalog.filter((command) => command.group === group).map(line),
  "",
]

export const help = (): string =>
  [
    `adiff ${version()}, for reviewing an agent's work in a worktree`,
    "",
    "Usage",
    "  adiff <command> [options]",
    "",
    ...groups.flatMap(under),
    "Run `adiff <command> --help` for what it needs, or `adiff describe` for the same as JSON.",
  ].join("\n")

const placeholder = (spec: OptionSpec): string =>
  spec.value === "flag" ? `--${spec.name}` : `--${spec.name} <${spec.value}>`

const wanted = (spec: OptionSpec): string =>
  spec.required ? placeholder(spec) : `[${placeholder(spec)}]`

export const usageOf = (command: CommandSpec): string =>
  [`adiff ${command.name}`, ...command.options.map(wanted)].join(" ")

const FIELDS: OptionSpec = {
  name: "fields",
  required: false,
  value: "a,b",
  about: "Narrow the answer to these fields, at every level",
}

const option = (spec: OptionSpec): string =>
  `  ${placeholder(spec).padEnd(OPTION_ROOM)}${spec.about}${spec.required ? " (required)" : ""}`

const answers = (command: CommandSpec): ReadonlyArray<string> =>
  command.dataKey === ""
    ? ["Answers by handing the terminal to the reviewer, not in JSON."]
    : [`Answers {"ok":true,"${command.dataKey}":…}`]

export const helpFor = (name: string): string | undefined => {
  const command = findCommand(name)
  if (command === undefined) return undefined
  const shown = command.dataKey === "" ? command.options : [...command.options, FIELDS]
  return [
    `adiff ${command.name}`,
    "",
    command.about,
    "",
    "Usage",
    `  ${usageOf(command)}`,
    "",
    "Options",
    ...shown.map(option),
    "",
    "Example",
    `  ${command.example}`,
    "",
    ...answers(command),
  ].join("\n")
}

const verb = (name: string): string => {
  const command = findCommand(name)
  const short = name.split(" ").slice(1).join(" ")
  return `  ${short.padEnd(NAME_ROOM)}${opening(command?.about ?? "")}`
}

export const helpUnder = (noun: string): string | undefined => {
  const verbs = verbsUnder(noun)
  if (verbs.length === 0) return undefined
  return [
    `adiff ${noun}`,
    "",
    "Usage",
    `  adiff ${noun} <verb> [options]`,
    "",
    "Verbs",
    ...verbs.map(verb),
    "",
    `Run \`adiff ${noun} <verb> --help\` for what it needs.`,
  ].join("\n")
}
