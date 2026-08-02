#!/usr/bin/env bun
// Enforces the two rules in docs/architecture.md that oxlint cannot express:
// no comments in src/, and no imports that reach past a module's index.ts.
// This file is a script, not src/, so it may explain itself.
import { globSync } from "node:fs"
import { readFile } from "node:fs/promises"

type Violation = { file: string; line: number; rule: string; detail: string }

const SRC = "src"
const MODULE_ROOTS = new Set(["domain", "service", "tui"])

const STRING_LITERAL = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g

const stripStrings = (line: string): string => line.replace(STRING_LITERAL, '""')

const SECTION_MARKER = /^\s*\/\/ (ARRANGE|ACT|ASSERT)\s*$/
const isTest = (file: string): boolean => file.endsWith(".test.ts")

const commentViolations = (file: string, source: string): Violation[] => {
  const out: Violation[] = []
  let inBlock = false
  source.split("\n").forEach((raw, index) => {
    const line = stripStrings(raw)
    if (inBlock) {
      if (line.includes("*/")) inBlock = false
      out.push({ file, line: index + 1, rule: "no-comments", detail: raw.trim() })
      return
    }
    const block = line.indexOf("/*")
    const inline = line.indexOf("//")
    if (block >= 0) {
      inBlock = !line.includes("*/", block + 2)
      out.push({ file, line: index + 1, rule: "no-comments", detail: raw.trim() })
      return
    }
    if (inline < 0) return
    if (isTest(file) && SECTION_MARKER.test(raw)) return
    out.push({ file, line: index + 1, rule: "no-comments", detail: raw.trim() })
  })
  return out
}

const moduleOf = (path: string): string | undefined => {
  const parts = path.split("/")
  if (parts[0] !== SRC) return undefined
  if (!MODULE_ROOTS.has(parts[1] ?? "")) return undefined
  return parts.slice(0, 3).join("/")
}

const crossesBoundary = (file: string, specifier: string): string | undefined => {
  if (!specifier.startsWith(".")) return undefined
  const dir = file.slice(0, file.lastIndexOf("/"))
  const resolved = new URL(specifier, `file:///${dir}/`).pathname.slice(1)
  const target = moduleOf(resolved)
  if (target === undefined || target === moduleOf(file)) return undefined
  const indexes = [target, `${target}/index`, `${target}/index.ts`]
  return indexes.includes(resolved) ? undefined : target
}

const boundaryViolations = (file: string, source: string): Violation[] => {
  const out: Violation[] = []
  source.split("\n").forEach((raw, index) => {
    const specifier = raw.match(/from\s+["']([^"']+)["']/)?.[1]
    if (specifier === undefined) return
    const target = crossesBoundary(file, specifier)
    if (target !== undefined) {
      out.push({ file, line: index + 1, rule: "module-boundary", detail: `${specifier} reaches past ${target}/index.ts` })
    }
  })
  return out
}

const CONSTRUCTOR = /constructor\s*\(([\s\S]*?)\)\s*\{/g
const PARAMETER_PROPERTY = /(?:^|,)\s*(?:private|public|protected|readonly)\s/

const strippableViolations = (file: string, source: string): Violation[] => {
  const out: Violation[] = []
  for (const match of stripStrings(source).matchAll(CONSTRUCTOR)) {
    if (!PARAMETER_PROPERTY.test(match[1] ?? "")) continue
    out.push({
      file,
      line: source.slice(0, match.index).split("\n").length,
      rule: "no-parameter-properties",
      detail: "node strips types only; parameter properties do not run",
    })
  }
  return out
}

const files = globSync(`${SRC}/**/*.ts`).toSorted()
const sources = await Promise.all(files.map(async (file) => [file, await readFile(file, "utf8")] as const))
const found: Violation[] = []
for (const [file, source] of sources) {
  found.push(...commentViolations(file, source))
  found.push(...boundaryViolations(file, source))
  found.push(...strippableViolations(file, source))
}

if (found.length === 0) {
  console.log(`check-style: ${files.length} files clean`)
  process.exit(0)
}

for (const v of found) console.log(`${v.file}:${v.line}  ${v.rule}  ${v.detail}`)
console.log(`\ncheck-style: ${found.length} violation${found.length === 1 ? "" : "s"}`)
process.exit(1)
