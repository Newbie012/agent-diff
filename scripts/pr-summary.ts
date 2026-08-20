import { argv, stdout } from "node:process"
import { bodyOf, intentNames, readingOf, releasedNames, sectionsIn } from "./lib/intents.ts"

const wanted = argv.slice(2).filter((token) => !token.startsWith("--"))

const released = releasedNames()

const intents =
  wanted.length > 0 ? wanted : [...intentNames()].filter((name) => !released.has(name)).toSorted()

if (intents.length === 0) {
  stdout.write(
    "No change intent is waiting for a release, so there is nothing to summarise. A branch that only refactors, tests or documents has no summary to paste — say what it did in prose instead.\n",
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
