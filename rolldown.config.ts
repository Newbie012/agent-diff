import { cp } from "node:fs/promises"
import { defineConfig } from "rolldown"

const grammarsCopied = {
  name: "grammars-copied",
  async writeBundle() {
    const copied = { recursive: true, filter: (path: string) => !path.endsWith(".ts") }
    await cp("src/tui/grammars", "dist/grammars", copied)
    await cp("src/service/syntax/grammars", "dist/grammars", copied)
  },
}

export default defineConfig({
  input: "src/main.ts",
  platform: "node",
  external: ["@opentui/core", "web-tree-sitter", /\.(wasm|scm)$/],
  transform: { target: "node22" },
  plugins: [grammarsCopied],
  output: {
    file: "dist/main.js",
    format: "esm",
    codeSplitting: false,
    sourcemap: false,
  },
})
