import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { addDefaultParsers } from "@opentui/core"
import { Effect } from "effect"

type Found = { readonly wasm: string; readonly highlights: string }

const besideThis = (path: string): string => fileURLToPath(new URL(`./grammars/${path}`, import.meta.url))

const onDisk: Effect.Effect<Found> = Effect.sync(() => ({
  wasm: besideThis("css/tree-sitter-css.wasm"),
  highlights: besideThis("css/highlights.scm"),
}))

const embedded: Effect.Effect<Found> = Effect.all({
  wasm: Effect.promise(() => import("./grammars/css/tree-sitter-css.wasm", { with: { type: "file" } })),
  highlights: Effect.promise(() => import("./grammars/css/highlights.scm", { with: { type: "file" } })),
}).pipe(Effect.map((loaded) => ({ wasm: loaded.wasm.default, highlights: loaded.highlights.default })))

const compiled = (): boolean => process.versions["bun"] !== undefined

const added = (found: Found): void => {
  if (!compiled() && !existsSync(found.wasm)) return
  addDefaultParsers([{ filetype: "css", queries: { highlights: [found.highlights] }, wasm: found.wasm }])
}

export const grammarsAdded = Effect.suspend(() => (compiled() ? embedded : onDisk)).pipe(
  Effect.map(added),
  Effect.catchCause(() => Effect.void),
)
