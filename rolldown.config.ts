import { cp } from "node:fs/promises"
import { defineConfig } from "rolldown"

const grammarsCopied = {
  name: "grammars-copied",
  async writeBundle() {
    await cp("src/tui/grammars", "dist/grammars", {
      recursive: true,
      filter: (path: string) => !path.endsWith(".ts"),
    })
  },
}

export default defineConfig({
  input: "src/main.ts",
  platform: "node",
  external: ["@opentui/core", /\.(wasm|scm)$/],
  transform: { target: "node22" },
  plugins: [grammarsCopied],
  output: {
    file: "dist/main.js",
    format: "esm",
    codeSplitting: false,
    sourcemap: false,
  },
})
