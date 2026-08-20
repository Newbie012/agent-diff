import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { argv, exit, stdout } from "node:process"
import { bodyOf, indent, INTENTS, LEDGER, intentNames, readingOf, sectionsIn } from "./lib/intents.ts"

const OUT = "CHANGELOG.md"
const TOP = "# Changelog"

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

const kept = (): string => (existsSync(OUT) ? readFileSync(OUT, "utf8") : `${TOP}\n`)

const versionsIn = (text: string): ReadonlySet<string> =>
  new Set(
    text
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => line.slice(3).trim()),
  )

const sectionIn = (text: string, version: string): string | undefined => {
  const lines = text.split("\n")
  const opens = lines.findIndex((line) => line.trim() === `## ${version}`)
  if (opens === -1) return undefined
  const shuts = lines.findIndex((line, at) => at > opens && line.startsWith("## "))
  return lines
    .slice(opens + 1, shuts === -1 ? undefined : shuts)
    .join("\n")
    .trim()
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

const releases = releasesIn(readFileSync(LEDGER, "utf8")).toSorted(compare)
const have = intentNames()
const held = kept()
const written = versionsIn(held)

const wanted = argv[2]

if (wanted !== undefined) {
  const already = sectionIn(held, wanted)
  if (already !== undefined) {
    stdout.write(`${already}\n`)
    exit(0)
  }
  const one = releases.find((release) => release.version === wanted)
  const entry = one === undefined ? undefined : entryFor(one, have)
  if (entry === undefined) {
    stdout.write(`No changelog entry for ${wanted}.\n`)
    exit(0)
  }
  stdout.write(`${entry.split("\n").slice(2).join("\n").trim()}\n`)
  exit(0)
}

const fresh = releases.flatMap((release) => {
  if (written.has(release.version)) return []
  const entry = entryFor(release, have)
  return entry === undefined ? [] : [entry]
})

const body = held.startsWith(TOP) ? held.slice(TOP.length).trimStart() : held.trimStart()
const whole = `${TOP}\n\n${[...fresh, body].filter((part) => part.length > 0).join("\n")}`

writeFileSync(OUT, whole.endsWith("\n") ? whole : `${whole}\n`, "utf8")

const now = versionsIn(readFileSync(OUT, "utf8"))

const spent = releases
  .filter((release) => now.has(release.version))
  .flatMap((release) => release.intents)
  .filter((intent) => have.has(intent))

for (const intent of spent) rmSync(join(INTENTS, `${intent}.md`), { force: true })

stdout.write(
  `${OUT}: ${fresh.length} new, ${now.size} total. ${spent.length} spent change intents removed.\n`,
)
