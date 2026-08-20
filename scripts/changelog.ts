import { readFileSync, writeFileSync } from "node:fs"
import { argv, exit, stdout } from "node:process"
import { bodyOf, indent, LEDGER, intentNames, readingOf, sectionsIn } from "./lib/intents.ts"

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

const entryFor = (release: Release, have: ReadonlySet<string>): string | undefined => {
  const readings = release.intents
    .filter((intent) => have.has(intent))
    .flatMap((intent) => {
      const body = bodyOf(intent)
      return body === undefined ? [] : [readingOf(body)]
    })
  const loose = readings.flatMap((reading) =>
    reading.loose.length === 0 ? [] : [`- ${indent(reading.loose).trim()}`],
  )
  const typed = readings.flatMap((reading) => reading.typed)
  const said = [...loose, ...sectionsIn(typed, true)]
  if (said.length === 0) return undefined
  return `## ${release.version}\n\n${said.join("\n\n")}\n`
}

const wanted = argv[2]
const releases = releasesIn(readFileSync(LEDGER, "utf8")).toSorted(compare)
const have = intentNames()

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
