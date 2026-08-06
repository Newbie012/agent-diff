#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const RENDERER_FLAGS = ["--experimental-ffi", "--disable-warning=ExperimentalWarning"]
const RENDERER_MAJOR = 26
const ENTRY = fileURLToPath(new URL("../dist/main.js", import.meta.url))

const home = homedir()

const SOURCES = [
  [process.env["FNM_DIR"] ?? join(home, ".local", "share", "fnm"), "node-versions", "installation/bin/node"],
  [join(home, "Library", "Application Support", "fnm"), "node-versions", "installation/bin/node"],
  [process.env["NVM_DIR"] ?? join(home, ".nvm"), "versions/node", "bin/node"],
  [process.env["ASDF_DATA_DIR"] ?? join(home, ".asdf"), "installs/nodejs", "bin/node"],
  [process.env["VOLTA_HOME"] ?? join(home, ".volta"), "tools/image/node", "bin/node"],
  [process.env["HOMEBREW_PREFIX"] ?? "/opt/homebrew", "opt", "bin/node"],
  ["/usr/local", "opt", "bin/node"],
]

const MESSAGE = [
  "adiff review open draws its terminal through node:ffi, which needs Node 26 or newer.",
  `This is Node ${process.versions.node}, and no Node ${RENDERER_MAJOR} was found on this machine.`,
  "Every other adiff command runs here. Install Node 26 to open the terminal.",
].join("\n")

const drawsTerminal = (argv) => {
  const words = argv.filter((token) => !token.startsWith("--"))
  return words[0] === "review" && words[1] === "open"
}

const rendersHere = () =>
  process.versions.bun !== undefined ||
  (typeof process.getBuiltinModule === "function" &&
    process.getBuiltinModule("node:ffi") !== undefined)

const NODE_DIRECTORY = /^(?:v?\d|node)/

const majorOf = (name) => Number(/\d+/.exec(name)?.[0] ?? Number.NaN)

const listed = (directory) => {
  try {
    return readdirSync(directory)
  } catch {
    return []
  }
}

const installsUnder = ([root, versions, binary]) =>
  listed(join(root, versions))
    .filter((name) => NODE_DIRECTORY.test(name))
    .map((name) => ({ major: majorOf(name), path: join(root, versions, name, binary) }))

const findRuntime = () => {
  if (majorOf(process.versions.node) >= RENDERER_MAJOR) return process.execPath
  const found = SOURCES.flatMap(installsUnder)
    .filter((install) => install.major >= RENDERER_MAJOR && existsSync(install.path))
    .toSorted((a, b) => b.major - a.major)
  return found[0]?.path
}

const relaunch = () => {
  const runtime = findRuntime()
  if (runtime === undefined) {
    process.stderr.write(`${MESSAGE}\n`)
    process.exit(1)
  }
  const args = [...RENDERER_FLAGS, ENTRY, ...process.argv.slice(2)]
  const run = spawnSync(runtime, args, { stdio: "inherit" })
  process.exit(run.status ?? 1)
}

if (drawsTerminal(process.argv.slice(2)) && !rendersHere()) relaunch()
else await import(ENTRY)
