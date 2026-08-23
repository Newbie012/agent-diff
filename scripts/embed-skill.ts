import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const source = fileURLToPath(new URL("../skills/adiff/SKILL.md", import.meta.url))
const target = fileURLToPath(new URL("../src/cli/shipped-skill.ts", import.meta.url))

const text = await readFile(source, "utf8")

const lines = text.split("\n").map((line) => `  ${JSON.stringify(line)},`)

const module = [
  "export const SHIPPED_SKILL: string = [",
  ...lines,
  '].join("\\n")',
  "",
].join("\n")

await writeFile(target, module, "utf8")

process.stdout.write(
  `embed-skill: skills/adiff/SKILL.md is ${text.split("\n").length} lines, now in src/cli/shipped-skill.ts\n`,
)
