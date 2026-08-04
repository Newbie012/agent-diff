import { execFile } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { realpath } from "node:fs/promises"
import { promisify } from "node:util"
import { variants, type BranchFixture, type FileFixture } from "./fixtures.ts"

const exec = promisify(execFile)

export type Branch = { readonly name: string; readonly worktree: string }

export type Workspace = {
  readonly root: string
  readonly repo: string
  readonly storeRoot: string
  readonly branches: ReadonlyArray<Branch>
  readonly dispose: () => Promise<void>
}

const IDENTITY = [
  ["config", "user.email", "simulation@adiff.local"],
  ["config", "user.name", "adiff simulation"],
  ["config", "commit.gpgsign", "false"],
]

export const series = async <A>(items: ReadonlyArray<A>, run: (item: A) => Promise<unknown>): Promise<void> => {
  const [head, ...rest] = items
  if (head === undefined) return
  await run(head)
  await series(rest, run)
}

const write = async (root: string, file: string, lines: ReadonlyArray<string>): Promise<void> => {
  const absolute = join(root, file)
  await mkdir(dirname(absolute), { recursive: true })
  await writeFile(absolute, lines.length === 0 ? "" : `${lines.join("\n")}\n`, "utf8")
}

const applyBefore = (repo: string, files: ReadonlyArray<FileFixture>): Promise<void> =>
  series(
    files.filter((file) => file.before.length > 0),
    (file) => write(repo, file.path, file.before),
  )

const applyAfter = (worktree: string, files: ReadonlyArray<FileFixture>): Promise<void> =>
  series(files, (file) =>
    file.after.length === 0
      ? rm(join(worktree, file.path), { force: true })
      : write(worktree, file.path, file.after),
  )

export type WorkspaceOptions = {
  readonly branches: number
  readonly at?: string | undefined
}

export const createWorkspace = async (options: WorkspaceOptions): Promise<Workspace> => {
  const count = options.branches
  const root = options.at ?? (await mkdtemp(join(tmpdir(), "adiff-sim-")))
  const repo = join(root, "repo")
  const storeRoot = join(root, "store")
  const git = async (cwd: string, args: ReadonlyArray<string>): Promise<void> => {
    await exec("git", [...args], { cwd })
  }

  await exec("git", ["init", "-q", "-b", "main", repo], { cwd: root })
  await series(IDENTITY, (args) => git(repo, args))
  await write(repo, "README.md", ["# teamspace", "", "A small SaaS nobody has reviewed yet."])
  await git(repo, ["add", "-A"])
  await git(repo, ["commit", "-q", "-m", "baseline"])

  const chosen: ReadonlyArray<BranchFixture> = variants.slice(0, Math.max(1, count))
  const branches: Array<Branch> = []
  const build = async (fixture: BranchFixture): Promise<void> => {
    await applyBefore(repo, fixture.files)
    await git(repo, ["add", "-A"])
    await git(repo, ["commit", "-q", "--allow-empty", "-m", `before ${fixture.name}`])
    const worktree = join(root, fixture.name)
    await git(repo, ["worktree", "add", "-q", "-b", fixture.name, worktree])
    await applyAfter(worktree, fixture.files)
    await git(worktree, ["add", "-A"])
    await git(worktree, ["commit", "-q", "-m", `agent: ${fixture.name.replaceAll("-", " ")}`])
    branches.push({ name: fixture.name, worktree: await realpath(worktree) })
  }
  await series(chosen, build)

  const keep = options.at !== undefined
  return {
    root,
    repo,
    storeRoot,
    branches,
    dispose: () => (keep ? Promise.resolve() : rm(root, { recursive: true, force: true })),
  }
}
