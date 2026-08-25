export type Told = {
  readonly editor?: string | undefined
  readonly visual?: string | undefined
  readonly fallback?: string | undefined
  readonly termProgram?: string | undefined
  readonly terminalEmulator?: string | undefined
}

export type Opening = {
  readonly command: string
  readonly args: ReadonlyArray<string>
}

const KNOWN: ReadonlyArray<readonly [string, string]> = [
  ["vscode", "code --goto {file}:{line}"],
  ["cursor", "cursor --goto {file}:{line}"],
  ["windsurf", "windsurf --goto {file}:{line}"],
  ["zed", "zed {file}:{line}"],
  ["jetbrains", "idea --line {line} {file}"],
]

const LINED: ReadonlyArray<readonly [string, string]> = [
  ["code", "{command} --goto {file}:{line}"],
  ["cursor", "{command} --goto {file}:{line}"],
  ["zed", "{command} {file}:{line}"],
  ["idea", "{command} --line {line} {file}"],
  ["subl", "{command} {file}:{line}"],
  ["vim", "{command} +{line} {file}"],
  ["nvim", "{command} +{line} {file}"],
  ["hx", "{command} {file}:{line}"],
  ["nano", "{command} +{line} {file}"],
  ["emacs", "{command} +{line} {file}"],
]

const named = (said: string): string =>
  said.trim().split(/\s+/)[0]?.split("/").at(-1) ?? ""

const shaped = (said: string): string => {
  if (said.includes("{file}")) return said
  const known = LINED.find(([name]) => name === named(said))
  return known === undefined ? `${said} {file}` : known[1].replace("{command}", said)
}

const guessed = (told: Told): string | undefined => {
  const marks = `${told.termProgram ?? ""} ${told.terminalEmulator ?? ""}`.toLowerCase()
  return KNOWN.find(([mark]) => marks.includes(mark))?.[1]
}

export const KNOWN_EDITORS: ReadonlyArray<string> = [
  "code",
  "cursor",
  "windsurf",
  "zed",
  "idea",
  "subl",
  "nvim",
  "vim",
  "hx",
  "emacs",
  "nano",
]

export const editorsAround = (found: (name: string) => boolean): ReadonlyArray<string> =>
  KNOWN_EDITORS.filter((name) => found(name)).map((name) => shaped(name))

export const templateFor = (told: Told): string | undefined => {
  const asked = told.editor ?? told.visual ?? told.fallback
  return asked === undefined || asked.trim().length === 0 ? guessed(told) : shaped(asked)
}

export const openingOf = (
  template: string,
  file: string,
  line: number,
): Opening | undefined => {
  const filled = template.replaceAll("{file}", file).replaceAll("{line}", String(line))
  const [command, ...args] = filled.trim().split(/\s+/)
  return command === undefined ? undefined : { command, args }
}
