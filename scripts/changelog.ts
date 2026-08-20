import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { argv, exit, stdout } from "node:process"

const LEDGER = ".changeset/ledger.yaml"
const INTENTS = ".changeset"
const OUT = "CHANGELOG.md"

type Release = {
  readonly version: string
  readonly intents: ReadonlyArray<string>
}

const versionOn = (line: string): string | undefined =>
  /^"(?<package>[^"]+)@(?<version>[^"@]+)":$/.exec(line)?.groups?.["version"]

const intentOn = (line: string): string | undefined =>
  /^ {4}- (?<name>.+)$/.exec(line)?.groups?.["name"]?.trim()

const releasesIn = (ledger: string): ReadonlyArray<Release> => {
  const found: Array<Release> = []
  let held: Array<string> = []
  let version: string | undefined
  for (const line of ledger.split("\n")) {
    const named = versionOn(line)
    const intent = intentOn(line)
    if (named !== undefined && version !== undefined) found.push({ version, intents: held })
    if (named !== undefined) held = []
    version = named ?? version
    if (intent !== undefined) held.push(intent)
  }
  if (version !== undefined) found.push({ version, intents: held })
  return found
}

const NUMBERS = /\d+/g

const rankOf = (version: string): ReadonlyArray<number> =>
  [...version.matchAll(NUMBERS)].map((found) => Number(found[0]))

const compare = (one: Release, two: Release): number => {
  const left = rankOf(one.version)
  const right = rankOf(two.version)
  const most = Math.max(left.length, right.length)
  for (let at = 0; at < most; at += 1) {
    const step = (right[at] ?? 0) - (left[at] ?? 0)
    if (step !== 0) return step
  }
  return one.version.localeCompare(two.version)
}

const bodyOf = (intent: string): string | undefined => {
  const path = join(INTENTS, `${intent}.md`)
  const raw = readFileSync(path, "utf8")
  const parts = raw.split("---")
  const said = (parts.length > 2 ? parts.slice(2).join("---") : raw).trim()
  return said.length === 0 ? undefined : said
}

type Entry = {
  readonly kind: string
  readonly area: string
  readonly said: string
  readonly detail: string
}

const SECTIONS = [
  ["breaking", "Breaking"],
  ["feat", "Added"],
  ["fix", "Fixed"],
  ["perf", "Performance"],
] as const

const HEAD = /^(?<kind>breaking|feat|fix|perf)\((?<area>[^)]+)\): (?<said>.+)$/

const capital = (word: string): string => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`

const indent = (text: string): string =>
  text
    .split("\n")
    .map((line) => (line.trim().length === 0 ? "" : `  ${line}`))
    .join("\n")

type Read = {
  readonly typed: ReadonlyArray<Entry>
  readonly loose: string
}

const readingOf = (body: string): Read => {
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

const bulletFor = (entry: Entry): string => {
  const said = `- **${capital(entry.area)}** — ${entry.said}`
  return entry.detail.length === 0 ? said : `${said}\n\n${indent(entry.detail)}`
}

const sectionsIn = (typed: ReadonlyArray<Entry>): ReadonlyArray<string> =>
  SECTIONS.flatMap(([kind, title]) => {
    const mine = typed.filter((entry) => entry.kind === kind)
    return mine.length === 0 ? [] : [`### ${title}\n\n${mine.map(bulletFor).join("\n\n")}`]
  })

const known = (): ReadonlySet<string> =>
  new Set(readdirSync(INTENTS).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)))

const entryFor = (release: Release, have: ReadonlySet<string>): string | undefined => {
  const readings = release.intents
    .filter((intent) => have.has(intent))
    .flatMap((intent) => {
      const body = bodyOf(intent)
      return body === undefined ? [] : [readingOf(body)]
    })
  const loose = readings
    .flatMap((reading) => (reading.loose.length === 0 ? [] : [`- ${indent(reading.loose).trim()}`]))
  const typed = readings.flatMap((reading) => reading.typed)
  const said = [...loose, ...sectionsIn(typed)]
  if (said.length === 0) return undefined
  return `## ${release.version}\n\n${said.join("\n\n")}\n`
}

const wanted = argv[2]
const releases = releasesIn(readFileSync(LEDGER, "utf8")).toSorted(compare)
const have = known()

if (wanted !== undefined) {
  const one = releases.find((release) => release.version === wanted)
  const entry = one === undefined ? undefined : entryFor(one, have)
  if (entry === undefined) {
    stdout.write(`No changelog entry for ${wanted}.\n`)
    exit(0)
  }
  stdout.write(`${entry.split("\n").slice(2).join("\n").trim()}\n`)
  exit(0)
}

const entries = releases.flatMap((release) => {
  const entry = entryFor(release, have)
  return entry === undefined ? [] : [entry]
})

writeFileSync(OUT, `# Changelog\n\n${entries.join("\n")}`, "utf8")
stdout.write(`${OUT}: ${entries.length} releases\n`)
