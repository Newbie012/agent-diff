// Run the review terminal against a synthetic repository.
//
//   pnpm simulate                 # three branches waiting for review (q to quit)
//   pnpm simulate --branches 1    # fewer
//   pnpm simulate --agent         # a fake agent answers comments as you send them
//   pnpm simulate --probe         # headless: run the whole round trip, print it, exit
//   pnpm simulate --keep          # leave the workspace on disk and print its path
import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import { NODE, runArgs } from "./lib/entry.ts"
import { seedDemo } from "./simulation/seed.ts"
import { createWorkspace, series, type Branch, type Workspace } from "./simulation/workspace.ts"

const exec = promisify(execFile)

type Comment = { readonly body: string; readonly file: string }

type Args = {
  branches: number
  agent: boolean
  probe: boolean
  keep: boolean
}

const FLAGS: Readonly<Record<string, keyof Args>> = { "--branches": "branches" }

const SWITCHES: Readonly<Record<string, true>> = {
  "--agent": true,
  "--probe": true,
  "--keep": true,
}

const applySwitch = (args: Args, token: string): void => {
  if (token === "--agent") args.agent = true
  if (token === "--probe") args.probe = true
  if (token === "--keep") args.keep = true
}

const parseArgs = (argv: ReadonlyArray<string>): Args => {
  const args: Args = { branches: 7, agent: false, probe: false, keep: false }
  argv.forEach((token, index) => {
    const numeric = FLAGS[token]
    if (numeric !== undefined) args[numeric] = Number(argv[index + 1] ?? 0) as never
    if (SWITCHES[token] !== undefined) applySwitch(args, token)
  })
  return args
}

type Envelope = {
  readonly ok: boolean
  readonly branches?: ReadonlyArray<{ readonly branch: string }>
  readonly comments?: ReadonlyArray<Comment>
}

const adiff = async (
  space: Workspace,
  args: ReadonlyArray<string>,
  cwd: string,
): Promise<Envelope | undefined> => {
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  const { stdout } = await exec(NODE, runArgs(args), { cwd, env, encoding: "utf8" })
  const line = stdout.split("\n").findLast((candidate) => candidate.startsWith("{"))
  return line === undefined ? undefined : (JSON.parse(line) as Envelope)
}

const answerOne = async (branch: Branch, comment: Comment): Promise<void> => {
  console.log(`  agent ${branch.name}: read "${comment.body.slice(0, 60)}" on ${comment.file}`)
  await exec("git", ["commit", "-q", "--allow-empty", "-m", `address review on ${comment.file}`], {
    cwd: branch.worktree,
  })
}

const answerComments = async (space: Workspace, branch: Branch): Promise<void> => {
  const taken = await adiff(space, ["comment", "take", "--worktree", ".", "--wait", "3"], branch.worktree)
  const comments: ReadonlyArray<Comment> = taken?.comments ?? []
  await series(comments, (comment) => answerOne(branch, comment))
}

const runAgents = async (space: Workspace, alive: () => boolean): Promise<void> => {
  if (!alive()) return
  await series(space.branches, (branch) => answerComments(space, branch))
  await runAgents(space, alive)
}

const probe = async (space: Workspace): Promise<void> => {
  const branch = space.branches[0]
  if (branch === undefined) return
  const listed = await adiff(space, ["branch", "list", "--repo", "."], space.repo)
  console.log("branches   ", JSON.stringify(listed))
  const file = "src/api/invitations.ts"
  await adiff(
    space,
    ["comment", "send", "--repo", ".", "--branch", branch.name, "--file", file,
     "--start", "12", "--end", "13", "--body", "Three status checks in a row. One error shape would do."],
    space.repo,
  )
  console.log("reviewed   ", JSON.stringify(await adiff(space, ["file", "review", "--repo", ".", "--branch", branch.name, "--file", file], space.repo)))
  console.log("progress   ", JSON.stringify(await adiff(space, ["review", "progress", "--repo", ".", "--branch", branch.name], space.repo)))
  console.log("agent takes", JSON.stringify(await adiff(space, ["comment", "take", "--worktree", "."], branch.worktree)))
  console.log(`\n${listed?.branches?.length ?? 0} branches, whole round trip green`)
}

const openTerminal = (space: Workspace): Promise<number> =>
  new Promise((resolve) => {
    const child = spawn(NODE, runArgs(["review", "open", "--repo", space.repo]), {
      cwd: space.repo,
      env: { ...process.env, ADIFF_ROOT: space.storeRoot },
      stdio: "inherit",
    })
    child.on("exit", (code) => resolve(code ?? 0))
  })

const args = parseArgs(process.argv.slice(2))
const space = await createWorkspace({ branches: args.branches })
await seedDemo(space)
let running = true

const cleanup = async (): Promise<void> => {
  running = false
  if (args.keep) console.log(`\nworkspace kept at ${space.root}`)
  else await space.dispose()
}

process.on("SIGINT", () => {
  void cleanup().then(() => process.exit(0))
})

if (args.probe) {
  await probe(space)
  await cleanup()
} else {
  console.log(`${space.branches.length} branches waiting for review in ${space.repo}`)
  if (args.agent) {
    console.log("a fake agent is listening on every worktree\n")
    void runAgents(space, () => running)
  }
  await openTerminal(space)
  await cleanup()
}
