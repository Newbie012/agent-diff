#!/usr/bin/env node
// Proves every custom oxlint rule still fires on a file that violates it.
// A rule that silently stops matching is worse than no rule.
import { execFile } from "node:child_process"
import { globSync } from "node:fs"
import { promisify } from "node:util"

const exec = promisify(execFile)

const FIXTURES = "tools/fixtures"
const CONFIG = "tools/rules-fixtures.json"

const ruleOf = (path: string): string => path.split("/").at(-1)?.replace(".ts", "") ?? ""

const expected = globSync(`${FIXTURES}/**/*.ts`).map(ruleOf).toSorted()

const { stdout } = await exec("npx", ["oxlint", "-c", CONFIG, FIXTURES], {
  encoding: "utf8",
}).catch((error: { stdout?: string }) => ({ stdout: error.stdout ?? "" }))

const fired = new Set([...stdout.matchAll(/adiff\(([a-z-]+)\)/g)].map((match) => match[1]))
const missed = expected.filter((rule) => !fired.has(rule))

if (missed.length > 0) {
  for (const rule of missed) console.log(`check-rules: ${rule} did not fire on ${FIXTURES}/${rule}.ts`)
  process.exit(1)
}

console.log(`check-rules: ${expected.length} rules each caught their violation`)
