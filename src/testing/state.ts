import { execFile } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { Tracer } from "./scenario/trace.ts"

const exec = promisify(execFile)

export type DriverOptions = { readonly remember?: boolean }

export type DriverState = {
  readonly tracer: Tracer
  readonly repo: string
  readonly workspace: string
  readonly sessionPath: string | undefined
  readonly storeRoot: string
  readonly git: (cwd: string, args: ReadonlyArray<string>) => Promise<string>
  readonly prependPath: (bin: string) => void
  readonly onDispose: (undo: () => void | Promise<void>) => void
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

export const createDriverState = async (options: DriverOptions = {}): Promise<DriverState> => {
  const workspace = await mkdtemp(join(tmpdir(), "adiff-"))
  const repo = join(workspace, "repo")
  const storeRoot = join(workspace, "store")

  const git = async (cwd: string, args: ReadonlyArray<string>): Promise<string> => {
    const { stdout } = await exec("git", [...args], { cwd, encoding: "utf8" })
    return stdout
  }

  await exec("git", ["init", "-q", "-b", "master", repo], { cwd: workspace })
  await series(IDENTITY, (args) => git(repo, args))

  const undos: Array<() => void | Promise<void>> = []
  const path = process.env["PATH"]

  const restorePath = (): void => {
    if (path === undefined) delete process.env["PATH"]
    else process.env["PATH"] = path
  }

  return {
    tracer: new Tracer(),
    repo,
    workspace,
    sessionPath: options.remember === true ? join(workspace, "session.json") : undefined,
    storeRoot,
    git,
    prependPath: (bin) => {
      process.env["PATH"] = `${bin}:${process.env["PATH"] ?? ""}`
    },
    onDispose: (undo) => {
      undos.push(undo)
    },
    dispose: async () => {
      await series(undos.toReversed(), async (undo) => undo())
      restorePath()
      await rm(workspace, { recursive: true, force: true })
    },
  }
}
