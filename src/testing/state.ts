import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

const exec = promisify(execFile)

export type DriverState = {
  readonly repo: string
  readonly storeRoot: string
  readonly git: (cwd: string, args: ReadonlyArray<string>) => Promise<string>
  readonly dispose: () => Promise<void>
}

const IDENTITY = [
  ["config", "user.email", "driver@adiff.test"],
  ["config", "user.name", "adiff driver"],
  ["config", "commit.gpgsign", "false"],
]

export const series = async <A>(
  items: ReadonlyArray<A>,
  run: (item: A) => Promise<unknown>,
): Promise<void> => {
  const [head, ...rest] = items
  if (head === undefined) return
  await run(head)
  await series(rest, run)
}

export const createDriverState = async (): Promise<DriverState> => {
  const workspace = await mkdtemp(join(tmpdir(), "adiff-"))
  const repo = join(workspace, "repo")
  const storeRoot = join(workspace, "store")

  const git = async (cwd: string, args: ReadonlyArray<string>): Promise<string> => {
    const { stdout } = await exec("git", [...args], { cwd, encoding: "utf8" })
    return stdout
  }

  await exec("git", ["init", "-q", "-b", "master", repo], { cwd: workspace })
  await series(IDENTITY, (args) => git(repo, args))

  return {
    repo,
    storeRoot,
    git,
    dispose: () => rm(workspace, { recursive: true, force: true }),
  }
}
