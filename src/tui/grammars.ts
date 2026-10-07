import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { addDefaultParsers } from "@opentui/core"
import { Effect } from "effect"

const besideThis = (path: string): string => fileURLToPath(new URL(`./grammars/${path}`, import.meta.url))

const css = {
  filetype: "css",
  queries: { highlights: [besideThis("css/highlights.scm")] },
  wasm: besideThis("css/tree-sitter-css.wasm"),
}

export const grammarsAdded = Effect.sync(() => {
  if (existsSync(css.wasm)) addDefaultParsers([css])
})
