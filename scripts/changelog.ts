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

const known = (): ReadonlySet<string> =>
  new Set(readdirSync(INTENTS).filter((name) => name.endsWith(".md")).map((name) => name.slice(0, -3)))

const entryFor = (release: Release, have: ReadonlySet<string>): string | undefined => {
  const said = release.intents
    .filter((intent) => have.has(intent))
    .flatMap((intent) => {
      const body = bodyOf(intent)
      return body === undefined ? [] : [`- ${body.replaceAll("\n", "\n  ")}`]
    })
  if (said.length === 0) return undefined
  return `## ${release.version}\n\n${said.join("\n\n")}\n`
}

const wanted = argv[2]
const releases = releasesIn(readFileSync(LEDGER, "utf8"))
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

const entries = releases
  .toSorted(compare)
  .flatMap((release) => {
    const entry = entryFor(release, have)
    return entry === undefined ? [] : [entry]
  })

writeFileSync(OUT, `# Changelog\n\n${entries.join("\n")}`, "utf8")
stdout.write(`${OUT}: ${entries.length} releases\n`)
