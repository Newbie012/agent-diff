import { execFileSync } from "node:child_process"
import { argv, stdout } from "node:process"
import { bodyOf, intentNames, readingOf, releasedNames, sectionsIn } from "./lib/intents.ts"

const value = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? undefined : argv[at + 1]
}

const wanted = argv.slice(2).filter((token) => !token.startsWith("--"))
const against = value("against") ?? "origin/main"

const git = (...args: ReadonlyArray<string>): string => {
  try {
    return execFileSync("git", [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return ""
  }
}

const onThisBranch = (): ReadonlyArray<string> => {
  const base = git("merge-base", "HEAD", against)
  if (base === "") return []
  return git("diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`, "--", ".changeset")
    .split("\n")
    .filter((path) => path.endsWith(".md") && !path.includes("/changelogs/"))
    .map((path) => path.slice(".changeset/".length, -".md".length))
}

const released = releasedNames()
const have = intentNames()

const mine = onThisBranch().filter((name) => have.has(name) && !released.has(name))

const intents = wanted.length > 0 ? wanted : mine.toSorted()

if (intents.length === 0) {
  stdout.write(
    `This branch adds no change intent against ${against}, so there is nothing to summarise. A branch that only refactors, tests or documents has no summary to paste — say what it did in prose instead.\n`,
  )
  process.exit(0)
}

const readings = intents.flatMap((intent) => {
  const body = bodyOf(intent)
  return body === undefined ? [] : [readingOf(body)]
})

const typed = readings.flatMap((reading) => reading.typed)
const loose = readings.filter((reading) => reading.loose.length > 0)

if (typed.length === 0) {
  stdout.write(
    `Nothing in ${intents.join(", ")} leads with \`kind(area): …\`, so there are no entries to group. See .claude/skills/release-notes/SKILL.md.\n`,
  )
  process.exit(1)
}

stdout.write(`## What changed\n\n${sectionsIn(typed, false).join("\n\n")}\n`)

if (loose.length > 0) {
  stdout.write(
    `\nNote: ${loose.length} intent(s) carry prose that leads with no \`kind(area):\` line. That prose is left out of this summary and out of the grouping in CHANGELOG.md.\n`,
  )
}
