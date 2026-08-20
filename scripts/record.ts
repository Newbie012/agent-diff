import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { argv, exit, stderr, stdout } from "node:process"
import { FLAGS, NODE } from "./lib/entry.ts"
import { tracesIn } from "./scenario.ts"

const run = (command: string, args: ReadonlyArray<string>): string =>
  execFileSync(command, [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim()

const git = (...args: ReadonlyArray<string>): string => run("git", args)

const value = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? undefined : argv[at + 1]
}

const onlyNamed = value("test")

const base = value("base") ?? "origin/main"

const changedTests = (): ReadonlyArray<string> =>
  git("diff", "--name-only", `${base}...HEAD`)
    .split("\n")
    .filter((path) => path.endsWith(".test.ts"))

const TITLE = /^\+\s*(?:test|it)\(\s*(?<quote>["'`])(?<title>.+?)\k<quote>/

const addedTitles = (): ReadonlySet<string> =>
  new Set(
    git("diff", `${base}...HEAD`, "--", "*.test.ts")
      .split("\n")
      .flatMap((line) => {
        const found = TITLE.exec(line)?.groups?.["title"]
        return found === undefined ? [] : [found]
      }),
  )

const wanted = onlyNamed === undefined ? changedTests() : [onlyNamed]

if (wanted.length === 0) {
  stdout.write("No test files changed on this branch, so there is nothing to record.\n")
  exit(0)
}

const where = mkdtempSync(join(tmpdir(), "adiff-record-"))
const trace = join(where, "trace.jsonl")

stderr.write(`Running ${wanted.length} test file${wanted.length === 1 ? "" : "s"}…\n`)
try {
  execFileSync("npx", ["vitest", "run", ...wanted], {
    env: { ...process.env, ADIFF_TRACE: trace, NODE_OPTIONS: "--experimental-ffi" },
    stdio: ["ignore", "ignore", "inherit"],
  })
} catch {
  stderr.write("Those tests do not pass, so there is nothing worth recording.\n")
  rmSync(where, { recursive: true, force: true })
  exit(1)
}

const added = onlyNamed === undefined ? addedTitles() : undefined
const wanted2 = tracesIn(trace).filter(
  (one) => added === undefined || [...added].some((title) => one.test.endsWith(title)),
)

const beyond = wanted2.filter((one) => (one.cannotReplay ?? []).length > 0)
for (const one of beyond) {
  stderr.write(
    `  skipped ${one.test} — it drives adiff with ${(one.cannotReplay ?? []).join(" and ")}, which a recording cannot replay\n`,
  )
}

const held = wanted2.filter((one) => (one.cannotReplay ?? []).length === 0)

if (held.length === 0) {
  stdout.write("No test was added on this branch, so there is nothing to record.\n")
  rmSync(where, { recursive: true, force: true })
  exit(0)
}
const filmed: Array<{ readonly test: string; readonly url: string }> = []

for (const one of held) {
  stderr.write(`  ${one.test}\n`)
  const said = run(NODE, [
    ...FLAGS,
    "scripts/shot.ts",
    "--trace",
    trace,
    "--test-name",
    one.test,
    "--video",
  ])
  const found = /(?<url>https:\/\/github\.com\/user-attachments\/assets\/[^\s)]+)/.exec(said)
  if (found?.groups?.["url"] !== undefined) filmed.push({ test: one.test, url: found.groups["url"] })
}

rmSync(where, { recursive: true, force: true })

if (filmed.length === 0) {
  stderr.write("Nothing was recorded.\n")
  exit(1)
}

const splitOn = " > "

const blockFor = (one: { readonly test: string; readonly url: string }): string => {
  const at = one.test.lastIndexOf(splitOn)
  const when = at === -1 ? one.test : one.test.slice(0, at)
  const then = at === -1 ? "" : one.test.slice(at + splitOn.length)
  return [
    `- ${when}`,
    "",
    `  <details>`,
    `  <summary><code>${then}</code></summary>`,
    "",
    `  ${one.url}`,
    "",
    `  </details>`,
  ].join("\n")
}

const whenOf = (one: { readonly test: string }): string => {
  const at = one.test.lastIndexOf(splitOn)
  return at === -1 ? one.test : one.test.slice(0, at)
}

const grouped = (): string =>
  [...new Set(filmed.map(whenOf))]
    .map((when) =>
      filmed
        .filter((one) => whenOf(one) === when)
        .map((one, at) => (at === 0 ? blockFor(one) : blockFor(one).split("\n").slice(2).join("\n")))
        .join("\n\n"),
    )
    .join("\n\n")

stdout.write(`## Recorded tests\n\n${grouped()}\n`)
