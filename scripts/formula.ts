import { readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"

const TEMPLATE = fileURLToPath(new URL("../packaging/adiff.rb.template", import.meta.url))

const FIELDS = ["VERSION", "ARM_URL", "ARM_SHA", "INTEL_URL", "INTEL_SHA"] as const

const valueOf = (field: (typeof FIELDS)[number]): string => {
  const found = process.env[field]
  if (found === undefined || found.length === 0) {
    process.stderr.write(`${field} is not set, so the formula would name an asset nobody can fetch\n`)
    process.exit(1)
  }
  return found
}

const out = process.argv[2]
if (out === undefined) {
  process.stderr.write("usage: formula.ts <path to write>\n")
  process.exit(1)
}

const rendered = FIELDS.reduce(
  (text, field) => text.replaceAll(`__${field}__`, valueOf(field)),
  await readFile(TEMPLATE, "utf8"),
)

if (rendered.includes("__")) {
  process.stderr.write("the rendered formula still carries a placeholder\n")
  process.exit(1)
}

await writeFile(out, rendered, "utf8")
process.stdout.write(`wrote ${out}\n`)
