import { execFile } from "node:child_process"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import type { DriverState } from "../../state.ts"

const exec = promisify(execFile)

const ENTRY = fileURLToPath(new URL("../../../main.ts", import.meta.url))

export type CliResult = {
  readonly code: number
  readonly stdout: string
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

const parse = (stdout: string): unknown => {
  const line = stdout.trim().split("\n").at(-1)
  return line === undefined || line.length === 0 ? undefined : JSON.parse(line)
}

export class AppTestDriver {
  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  async run(args: ReadonlyArray<string>): Promise<CliResult> {
    const env = { ...process.env, ADIFF_ROOT: this.state.storeRoot }
    try {
      const { stdout } = await exec(process.execPath, ["--experimental-ffi", ENTRY, ...args], { env, encoding: "utf8" })
      return { code: 0, stdout, envelope: parse(stdout) }
    } catch (cause) {
      const failure = cause as { code?: number; stdout?: string }
      const stdout = failure.stdout ?? ""
      return { code: failure.code ?? 1, stdout, envelope: parse(stdout) }
    }
  }

  runBranches(): Promise<CliResult> {
    return this.run(["branches", "--repo", this.state.repo])
  }

  runVouch(options: { readonly branch: string; readonly file: string }): Promise<CliResult> {
    return this.run([
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
    return this.run(["progress", "--repo", this.state.repo, "--branch", branch])
  }

  runComment(options: CommentOptions): Promise<CliResult> {
    return this.run([
      "comment",
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
