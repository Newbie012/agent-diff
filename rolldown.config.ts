import { defineConfig } from "rolldown"

export default defineConfig({
  input: "src/main.ts",
  platform: "node",
  external: ["@opentui/core"],
  transform: { target: "node26" },
  output: {
    file: "dist/main.js",
    format: "esm",
    codeSplitting: false,
    sourcemap: false,
  },
})
