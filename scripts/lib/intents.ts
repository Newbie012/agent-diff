import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

export const INTENTS = ".changeset"

export const LEDGER = join(INTENTS, "ledger.yaml")

export type Entry = {
  readonly kind: string
  readonly area: string
  readonly said: string
  readonly detail: string
}

export type Reading = {
  readonly typed: ReadonlyArray<Entry>
  readonly loose: string
}

export const SECTIONS = [
  ["breaking", "Breaking"],
  ["feat", "Added"],
  ["fix", "Fixed"],
  ["perf", "Performance"],
] as const

const HEAD = /^(?<kind>breaking|feat|fix|perf)\((?<area>[^)]+)\): (?<said>.+)$/

const capital = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`

export const indent = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line.trim().length === 0 ? "" : `  ${line}`))
    .join("\n")

export const bodyOf = (intent: string): string | undefined => {
  const raw = readFileSync(join(INTENTS, `${intent}.md`), "utf8")
  const parts = raw.split("---")
  const said = (parts.length > 2 ? parts.slice(2).join("---") : raw).trim()
  return said.length === 0 ? undefined : said
}

export const readingOf = (body: string): Reading => {
  const typed: Array<{ kind: string; area: string; said: string; detail: Array<string> }> = []
  const loose: Array<string> = []
  for (const line of body.split("\n")) {
    const found = HEAD.exec(line)?.groups
    if (found !== undefined) {
      typed.push({
        kind: found["kind"] ?? "",
        area: found["area"] ?? "",
        said: found["said"] ?? "",
        detail: [],
      })
      continue
    }
    const held = typed.at(-1)
    if (held === undefined) loose.push(line)
    else held.detail.push(line)
  }
  return {
    typed: typed.map((held) => ({
      kind: held.kind,
      area: held.area,
      said: held.said,
      detail: held.detail.join("\n").trim(),
    })),
    loose: loose.join("\n").trim(),
  }
}

export const bulletFor = (entry: Entry, folded: boolean): string => {
  const said = `- **${capital(entry.area)}** — ${entry.said}`
  if (!folded || entry.detail.length === 0) return said
  return `${said}\n\n${indent(entry.detail)}`
}

export const sectionsIn = (
  typed: ReadonlyArray<Entry>,
  folded: boolean,
): ReadonlyArray<string> =>
  SECTIONS.flatMap(([kind, title]) => {
    const mine = typed.filter((entry) => entry.kind === kind)
    return mine.length === 0
      ? []
      : [`### ${title}\n\n${mine.map((entry) => bulletFor(entry, folded)).join(folded ? "\n\n" : "\n")}`]
  })

export const intentNames = (): ReadonlySet<string> =>
  new Set(
    readdirSync(INTENTS)
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3)),
  )

export const releasedNames = (): ReadonlySet<string> =>
  new Set(
    readFileSync(LEDGER, "utf8")
      .split("\n")
      .flatMap((line) => {
        const found = /^ {4}- (?<name>.+)$/.exec(line)?.groups?.["name"]?.trim()
        return found === undefined ? [] : [found]
      }),
  )
