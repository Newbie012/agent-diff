import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
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

export type LayerInput = {
  readonly title: string
  readonly note?: string
  readonly spans: ReadonlyArray<{ readonly path: string; readonly start: number; readonly end: number }>
}

export type LayersInput = {
  readonly summary?: string
  readonly layers: ReadonlyArray<LayerInput>
}

export type PullInput = {
  readonly branch: string
  readonly state: "open" | "merged" | "closed"
  readonly draft?: boolean
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

  private runWith(args: ReadonlyArray<string>, input: string): Promise<CliResult> {
    const env = { ...process.env, ADIFF_ROOT: this.state.storeRoot }
    return new Promise((resolve) => {
      const child = execFile(
        process.execPath,
        [...NODE_FLAGS, ENTRY, ...args],
        { env, encoding: "utf8" },
        (cause, stdout, stderr) => {
          const failed = cause as { code?: number } | null
          const code = failed === null ? 0 : Number(failed.code ?? 1)
          resolve({
            code,
            stdout: String(stdout),
            stderr: String(stderr),
            envelope: parse(String(stderr)) || parse(String(stdout)),
          })
        },
      )
      child.stdin?.end(input)
    })
  }

  async setPullRequests(pulls: ReadonlyArray<PullInput>, delayMs = 0): Promise<void> {
    const bin = join(this.state.workspace, "bin")
    await mkdir(bin, { recursive: true })
    const rows = pulls.map((pull) => ({
      headRefName: pull.branch,
      state: pull.state.toUpperCase(),
      isDraft: pull.draft === true,
    }))
    const script = [
      "#!/bin/sh",
      delayMs > 0 ? `sleep ${(delayMs / 1000).toFixed(2)}` : "",
      `cat <<'JSON'`,
      JSON.stringify(rows),
      "JSON",
    ]
      .filter((line) => line.length > 0)
      .join("\n")
    const path = join(bin, "gh")
    await writeFile(path, `${script}\n`, { mode: 0o755 })
    process.env["PATH"] = `${bin}:${process.env["PATH"] ?? ""}`
  }

  runLayersSet(worktree: string, layers: LayersInput | string): Promise<CliResult> {
    const document = typeof layers === "string" ? layers : JSON.stringify(layers)
    return this.runWith(["layers", "set", "--worktree", worktree, "--json", "-"], document)
  }

  runLayersShow(worktree: string, fields?: ReadonlyArray<string>): Promise<CliResult> {
    return this.run(["layers", "show", "--worktree", worktree, ...(fields ?? [])])
  }

  runStage(options: CommentOptions): Promise<CliResult> {
    return this.run([
      "comment",
      "stage",
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

  runSubmit(branch: string): Promise<CliResult> {
    return this.run(["review", "submit", "--repo", this.state.repo, "--branch", branch])
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
