import { cp } from "node:fs/promises"
import { defineConfig } from "rolldown"

const grammarsCopied = {
  name: "grammars-copied",
  async writeBundle() {
    await cp("src/tui/grammars", "dist/grammars", { recursive: true })
  },
}

export default defineConfig({
  input: "src/main.ts",
  platform: "node",
  external: ["@opentui/core"],
  transform: { target: "node22" },
  plugins: [grammarsCopied],
  output: {
    file: "dist/main.js",
    format: "esm",
    codeSplitting: false,
    sourcemap: false,
  },
})
