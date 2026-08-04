// Where the dev tools find the CLI. They run the TypeScript entry through node,
// so a run always reflects the working tree. bin/adiff.js loads the bundle in
// dist/, which is what an install gets and only exists after a build.
import { fileURLToPath } from "node:url"

export const NODE = process.execPath

export const FLAGS = ["--experimental-ffi", "--disable-warning=ExperimentalWarning"] as const

export const ENTRY = fileURLToPath(new URL("../../src/main.ts", import.meta.url))

export const runArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...FLAGS,
  ENTRY,
  ...args,
]
