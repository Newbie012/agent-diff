#!/usr/bin/env node
// Refuses text bound for a public page that carries anything private: a person, a private
// repository, a ticket, or a report of who asked. Reads a file when given one, so a PR body can be
// checked before it is posted; with no argument it checks every change intent, the changelog, the
// wiki and the PRD contracts. Proves each refusal on its own fixtures first.
import { readFile } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { globSync } from "node:fs"

type Rule = { readonly name: string; readonly of: RegExp; readonly why: string }

const RULES: ReadonlyArray<Rule> = [
  {
    name: "who-asked",
    of: /\b(?:reported|asked|flagged|complained|said|noticed|spotted|found)\s+(?:it|this|that|by)?\s*\b(?:by\s+)?[A-Z][a-z]+\b|\b[A-Z][a-z]+\s+(?:reported|asked|flagged|complained|noticed|spotted)\b/,
    why: "says who reported it. A public page carries the defect, never the person.",
  },
  {
    name: "a-colleague",
    of: /\bmy\s+(?:teammate|colleague|coworker|co-worker|workmate|manager)\b/i,
    why: "places the defect with somebody at work. Describe what broke instead.",
  },
  {
    name: "a-private-repo",
    of: /\b(?:oligo|oligosecurity)\b/i,
    why: "names private work. Nothing outside this repository belongs on a public page.",
  },
  {
    name: "a-ticket",
    of: /\b(?!prd-|adr-|pr-|rfc-|iso-|sha-|utf-|es-|ipv)[a-z]{2,5}-\d{2,6}(?:-[a-z][a-z0-9-]*)?\b/i,
    why: "carries a ticket or a branch from private work.",
  },
]

const ALLOWED =
  /^(?:alpha|beta|next|node|base|utf|ipv4|sha|md|es|http|v\d|x86|arm)-[\dA-Za-z]/i

const FIXTURES: ReadonlyArray<readonly [string, string]> = [
  ["who-asked", "Guy reported it and the harness confirms it."],
  ["a-colleague", "This happened to my teammate on the latest version."],
  ["a-private-repo", "Reproduced in the oligo checkout."],
  ["a-ticket", "Seen on branch cdr-1023-fork-and-exec-lines."],
]

const wrongIn = (text: string): ReadonlyArray<Rule> =>
  RULES.filter((rule) => {
    const found = rule.of.exec(text)
    return found !== null && !ALLOWED.test(found[0])
  })

const proved = (): boolean => {
  for (const [name, text] of FIXTURES) {
    if (!wrongIn(text).some((rule) => rule.name === name)) {
      console.log(`check-public: ${name} no longer fires on "${text}"`)
      return false
    }
  }
  return true
}

if (!proved()) process.exit(1)

const asked = process.argv[2]

const PAGES = ["CHANGELOG.md", "README.md"]

const targets = (): ReadonlyArray<string> =>
  asked === undefined
    ? [
        ...globSync(".changeset/*.md"),
        ...globSync("wiki/*.md"),
        ...globSync(".agents/prd/*.md"),
        ...PAGES,
      ]
    : [asked]

const read = await Promise.all(
  targets().map(async (path) => ({ path, text: await readFile(path, "utf8").catch(() => "") })),
)

const found = read.flatMap(({ path, text }) => wrongIn(text).map((rule) => ({ path, rule })))

for (const { path, rule } of found) console.log(`check-public: ${path} ${rule.why}`)

let bad = found.length

const LONGEST = 300

const WHAT = "### What changed"

const RECORDED = "### Recorded tests"

const testsChanged = (): ReadonlyArray<string> => {
  try {
    const said = execFileSync("git", ["diff", "--name-only", "origin/main...HEAD"], {
      encoding: "utf8",
    })
    return said.split("\n").filter((path) => /^src\/testing\/.+\.test\.ts$/.test(path.trim()))
  } catch {
    return []
  }
}

const NO_FILM = /no recording/i

const shapeOf = (body: string): ReadonlyArray<string> => {
  const lines = body.split("\n")
  const heads = lines.filter((line) => line.startsWith("#"))
  const wrong: Array<string> = []
  if (heads[0] !== WHAT) wrong.push(`opens with "${WHAT}" and nothing above it`)
  const spare = heads.filter((head) => head !== WHAT && head !== RECORDED)
  if (spare.length > 0) wrong.push(`carries only ${WHAT} and ${RECORDED}, not ${spare.join(", ")}`)
  if (heads.length > 1 && heads[1] !== RECORDED) wrong.push(`puts ${RECORDED} second`)
  const said = lines
    .slice(1, heads.length > 1 ? lines.indexOf(RECORDED) : undefined)
    .join(" ")
    .trim()
  if (said.length > LONGEST) {
    wrong.push(`says what changed in ${LONGEST} characters or fewer, not ${said.length}`)
  }
  const filmed = heads.includes(RECORDED) || NO_FILM.test(body)
  if (!filmed && testsChanged().length > 0) {
    wrong.push(
      `carries ${RECORDED} from \`pnpm record\`, because this branch changes ${testsChanged().length} test file(s) — or a line saying "No recording" and why`,
    )
  }
  return wrong
}

if (asked !== undefined) {
  const body = await readFile(asked, "utf8").catch(() => "")
  for (const wrong of shapeOf(body)) {
    console.log(`check-public: ${asked} must be a body that ${wrong}.`)
    bad += 1
  }
}

if (bad > 0) process.exit(1)

console.log(
  asked === undefined
    ? `check-public: ${RULES.length} refusals each fired, and every public page is clear of them`
    : `check-public: ${asked} is clear`,
)
