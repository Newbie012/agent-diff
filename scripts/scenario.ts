import { spawn } from "node:child_process"
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, resolve as resolvePath } from "node:path"
import { fileURLToPath } from "node:url"
import { argv, env, exit, stderr } from "node:process"
import { NODE, runArgs } from "./lib/entry.ts"
import { createWorkspace, type Workspace } from "./simulation/workspace.ts"
import type { Scenario } from "../src/testing/scenario/index.ts"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolvePath(HERE, "..", "src", "testing")

const filesUnder = (where: string): ReadonlyArray<string> =>
  readdirSync(where).flatMap((name) => {
    const path = join(where, name)
    if (statSync(path).isDirectory()) return filesUnder(path)
    return name.endsWith(".scenario.ts") ? [path] : []
  })

const scenariosIn = (held: Record<string, unknown>): ReadonlyArray<Scenario> =>
  Object.values(held).flatMap((value) => {
    const said = value as Partial<Scenario>
    return typeof said?.name === "string" && Array.isArray(said.steps) ? [said as Scenario] : []
  })

export const everyScenario = async (): Promise<ReadonlyArray<Scenario>> => {
  const held = await Promise.all(
    filesUnder(ROOT).map((path) => import(path) as Promise<Record<string, unknown>>),
  )
  return held.flatMap(scenariosIn)
}

export const scenarioNamed = async (name: string): Promise<Scenario> => {
  const every = await everyScenario()
  const found = every.find((said) => said.name === name)
  if (found === undefined) {
    stderr.write(
      `No scenario called ${name}. There are ${every.length}:\n${every.map((said) => `  ${said.name}`).join("\n")}\n`,
    )
    exit(1)
  }
  return found
}

export const worldOf = (said: Scenario): Promise<Workspace> =>
  createWorkspace({
    branches: 1,
    fixtures: [
      {
        name: said.world.branch.name ?? said.name,
        files: said.world.branch.files ?? [],
      },
    ],
  })

const quietForge = (space: Workspace): string => {
  const bin = join(space.root, "bin")
  mkdirSync(bin, { recursive: true })
  writeFileSync(join(bin, "gh"), "#!/bin/sh\nprintf '[]'\n", { mode: 0o755 })
  return bin
}

const openTerminal = (space: Workspace): Promise<number> =>
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

if (argv[1]?.endsWith("scenario.ts") === true && argv[2] !== undefined) {
  const said = await scenarioNamed(argv[2])
  const space = await worldOf(said)
  await openTerminal(space)
  await space.dispose()
}
