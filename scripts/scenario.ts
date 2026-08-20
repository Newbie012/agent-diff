import { spawn } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { argv, env, exit, stderr } from "node:process"
import { NODE, runArgs } from "./lib/entry.ts"
import { createWorkspace, type Workspace } from "./simulation/workspace.ts"
import type { Trace } from "../src/testing/scenario/index.ts"

export const tracesIn = (path: string): ReadonlyArray<Trace> =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Trace)

export const traceNamed = (path: string, test: string): Trace => {
  const every = tracesIn(path)
  const found = every.find((held) => held.test === test)
  if (found === undefined) {
    stderr.write(`No trace for ${test}. There are ${every.length}.\n`)
    exit(1)
  }
  return found
}

export const worldOf = (held: Trace): Promise<Workspace> =>
  createWorkspace({
    branches: 1,
    fixtures: [
      {
        name: held.world.branch.name ?? "review",
        files: held.world.branch.files ?? [],
      },
    ],
  })

const quietForge = (space: Workspace): string => {
  const bin = join(space.root, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, "gh"), "#!/bin/sh\nprintf '[]'\n", { mode: 0o755 })
  return bin
}

export const openTerminal = (space: Workspace): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(NODE, runArgs(["review", "open", "--repo", space.repo]), {
      cwd: space.repo,
      env: {
        ...env,
        ADIFF_ROOT: space.storeRoot,
        ADIFF_NO_UPGRADE_CHECK: "1",
        PATH: `${quietForge(space)}:${env["PATH"] ?? ""}`,
      },
      stdio: "inherit",
    })
    child.on("exit", (code) => resolve(code ?? 0))
  })

const asked = argv[2]
const wanted = argv[3]
const isEntry = argv[1]?.endsWith("scenario.ts") === true

if (isEntry && asked !== undefined && wanted !== undefined) {
  const held = traceNamed(asked, wanted)
  const space = await worldOf(held)
  await openTerminal(space)
  await space.dispose()
}
