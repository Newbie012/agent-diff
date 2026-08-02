import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import type { DriverState } from "../../state.ts"

const exec = promisify(execFile)

const NODE_FLAGS = ["--experimental-ffi", "--disable-warning=ExperimentalWarning"]

const ENTRY = fileURLToPath(new URL("../../../main.ts", import.meta.url))

export type CliResult = {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  readonly envelope: unknown
}

export type CommentOptions = {
  readonly branch: string
  readonly file: string
  readonly start: number
  readonly end: number
  readonly body: string
  readonly side?: "old" | "new"
}

const parse = (text: string): unknown => {
  const line = text.split("\n").findLast((candidate) => candidate.startsWith("{"))
  return line === undefined ? undefined : JSON.parse(line)
}

export class AppTestDriver {
  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  async run(args: ReadonlyArray<string>): Promise<CliResult> {
    const env = { ...process.env, ADIFF_ROOT: this.state.storeRoot }
    try {
      const { stdout, stderr } = await exec(process.execPath, [...NODE_FLAGS, ENTRY, ...args], { env, encoding: "utf8" })
      return { code: 0, stdout, stderr, envelope: parse(stdout) }
    } catch (cause) {
      const failed = cause as { code?: number; stdout?: string; stderr?: string }
      const stdout = failed.stdout ?? ""
      const stderr = failed.stderr ?? ""
      return { code: failed.code ?? 1, stdout, stderr, envelope: parse(stderr) || parse(stdout) }
    }
  }

  runDescribe(command?: string): Promise<CliResult> {
    return this.run(command === undefined ? ["describe"] : ["describe", "--command", command])
  }

  runTake(worktree: string, wait?: number): Promise<CliResult> {
    const args = ["comment", "take", "--worktree", worktree]
    return this.run(wait === undefined ? args : [...args, "--wait", String(wait)])
  }

  runBranches(fields?: ReadonlyArray<string>): Promise<CliResult> {
    return this.run(["branch", "list", "--repo", this.state.repo, ...(fields ?? [])])
  }

  runVouch(options: { readonly branch: string; readonly file: string }): Promise<CliResult> {
    return this.run([
      "file",
      "vouch",
      "--repo",
      this.state.repo,
      "--branch",
      options.branch,
      "--file",
      options.file,
    ])
  }

  runProgress(branch: string): Promise<CliResult> {
    return this.run(["review", "progress", "--repo", this.state.repo, "--branch", branch])
  }

  runComment(options: CommentOptions): Promise<CliResult> {
    return this.run([
      "comment",
      "add",
      "--repo",
      this.state.repo,
      "--branch",
      options.branch,
      "--file",
      options.file,
      "--start",
      String(options.start),
      "--end",
      String(options.end),
      "--body",
      options.body,
      ...(options.side === undefined ? [] : ["--side", options.side]),
    ])
  }
}
