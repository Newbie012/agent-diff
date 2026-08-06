import { spawn } from "node:child_process"
import { access, mkdir, rm } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"
import { ENTRY, FLAGS } from "./lib/entry.ts"
import { seedDemo } from "./simulation/seed.ts"
import { createWorkspace } from "./simulation/workspace.ts"

const HOME = join(homedir(), ".cache", "adiff", "watch")
const fresh = process.argv.includes("--fresh")
const branches = Number(process.argv[process.argv.indexOf("--branches") + 1] || 7)

const exists = async (path: string): Promise<boolean> =>
  access(path)
    .then(() => true)
    .catch(() => false)

if (fresh) await rm(HOME, { recursive: true, force: true })
await mkdir(HOME, { recursive: true })

const repo = join(HOME, "repo")
if (!(await exists(repo))) {
  process.stdout.write("building the workspace once…\n")
  const space = await createWorkspace({ branches, at: HOME })
  await seedDemo(space)
}

process.stdout.write(`watching src/ — edit and it reloads, keeping your place\n`)

const child = spawn(
  process.execPath,
  [
    "--watch",
    "--watch-path=src",
    ...FLAGS,
    ENTRY,
    "review",
    "open",
    "--repo",
    repo,
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      ADIFF_ROOT: join(HOME, "store"),
      ADIFF_SESSION: join(HOME, "session.json"),
    },
  },
)

child.on("exit", (code) => process.exit(code ?? 0))
