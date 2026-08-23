import { execFile } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"
import { series, type DriverState } from "../../state.ts"

const exec = promisify(execFile)

const NODE_FLAGS = ["--experimental-ffi", "--disable-warning=ExperimentalWarning"]

const ENTRY = fileURLToPath(new URL("../../../main.ts", import.meta.url))

export type CliResult = {
  readonly code: number
  readonly stdout: string
  readonly stderr: string
  readonly envelope: unknown
}

export type BlockInput =
  | { readonly kind: "prose"; readonly markdown: string }
  | { readonly kind: "code"; readonly path: string; readonly start: number; readonly end: number }

export type LayerInput = {
  readonly title: string
  readonly note?: string
  readonly blocks?: ReadonlyArray<BlockInput>
  readonly spans?: ReadonlyArray<{ readonly path: string; readonly start: number; readonly end: number }>
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

  async run(
    args: ReadonlyArray<string>,
    extra: Readonly<Record<string, string>> = {},
    cwd?: string,
  ): Promise<CliResult> {
    const env = {
      ...process.env,
      HOME: this.state.workspace,
      ADIFF_ROOT: this.state.storeRoot,
      ...extra,
    }
    const where = cwd === undefined ? {} : { cwd }
    try {
      const { stdout, stderr } = await exec(process.execPath, [...NODE_FLAGS, ENTRY, ...args], { env, encoding: "utf8", ...where })
      return { code: 0, stdout, stderr, envelope: parse(stdout) }
    } catch (cause) {
      const failed = cause as { code?: number; stdout?: string; stderr?: string }
      const stdout = failed.stdout ?? ""
      const stderr = failed.stderr ?? ""
      return { code: failed.code ?? 1, stdout, stderr, envelope: parse(stderr) || parse(stdout) }
    }
  }

  private runWith(args: ReadonlyArray<string>, input: string): Promise<CliResult> {
    const env = {
      ...process.env,
      HOME: this.state.workspace,
      ADIFF_ROOT: this.state.storeRoot,
    }
    return new Promise((resolve) => {
      const child = execFile(
        process.execPath,
        [...NODE_FLAGS, ENTRY, ...args],
        { env, encoding: "utf8" },
        (cause, stdout, stderr) => {
          const failed = cause as { code?: number } | null
          const code = failed === null ? 0 : (failed.code ?? 1)
          resolve({
            code,
            stdout,
            stderr,
            envelope: parse(stderr) || parse(stdout),
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
      `echo "$@" >> ${join(bin, "asked.txt")}`,
      delayMs > 0 ? `sleep ${(delayMs / 1000).toFixed(2)}` : "",
      `cat <<'JSON'`,
      JSON.stringify(rows),
      "JSON",
    ]
      .filter((line) => line.length > 0)
      .join("\n")
    const path = join(bin, "gh")
    await writeFile(path, `${script}\n`, { mode: 0o755 })
    this.state.prependPath(bin)
  }

  async setRegistry(tags: Readonly<Record<string, string>>): Promise<string> {
    const server = createServer((_, response) => {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify(tags))
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    this.state.onDispose(
      () => new Promise<void>((resolve) => server.close(() => resolve())),
    )
    const address = server.address()
    const port = typeof address === "object" && address !== null ? address.port : 0
    return `http://127.0.0.1:${port}/dist-tags`
  }

  async installedBy(
    route: string,
    options: { readonly fails?: boolean } = {},
  ): Promise<Record<string, string>> {
    const bin = join(this.state.workspace, "installers")
    await mkdir(bin, { recursive: true })
    const script = [
      "#!/bin/sh",
      'echo "$(basename "$0") ran with $*"',
      options.fails === true ? "exit 1" : "exit 0",
    ].join("\n")
    await series(["brew", "npm", "bun"], (tool) =>
      writeFile(join(bin, tool), `${script}\n`, { mode: 0o755 }),
    )
    return { ADIFF_UPGRADE_ROUTE: route, PATH: `${bin}:${process.env["PATH"] ?? ""}` }
  }

  async setForgeSilent(): Promise<void> {
    const bin = join(this.state.workspace, "bin")
    await mkdir(bin, { recursive: true })
    const path = join(bin, "gh")
    await writeFile(path, "#!/bin/sh\nexit 1\n", { mode: 0o755 })
    this.state.prependPath(bin)
  }

  async listForgeRequests(): Promise<ReadonlyArray<string>> {
    const path = join(this.state.workspace, "bin", "asked.txt")
    const raw = await readFile(path, "utf8").catch(() => "")
    return raw.split("\n").filter((line) => line.trim().length > 0)
  }

  runLayersSet(worktree: string, layers: LayersInput | string): Promise<CliResult> {
    if (typeof layers !== "string") this.state.tracer.sawLayers(layers)
    const document = typeof layers === "string" ? layers : JSON.stringify(layers)
    return this.runWith(["layers", "set", "--worktree", worktree, "--json", "-"], document)
  }

  runLayersShow(worktree: string, fields?: ReadonlyArray<string>): Promise<CliResult> {
    return this.run(["layers", "show", "--worktree", worktree, ...(fields ?? [])])
  }

  runAnswer(options: {
    readonly worktree: string
    readonly id: string
    readonly body: string
    readonly asks?: boolean
  }): Promise<CliResult> {
    this.state.tracer.cannotReplay("an answer sent from the command line")
    return this.run([
      "comment",
      "answer",
      "--worktree",
      options.worktree,
      "--id",
      options.id,
      "--body",
      options.body,
      ...(options.asks === true ? ["--question"] : []),
    ])
  }

  runThreads(branch: string, fields?: ReadonlyArray<string>): Promise<CliResult> {
    return this.run(["comment", "list", "--repo", this.state.repo, "--branch", branch, ...(fields ?? [])])
  }

  runResolve(options: { readonly branch: string; readonly id: string }): Promise<CliResult> {
    this.state.tracer.cannotReplay("a thread settled from the command line")
    return this.run([
      "comment",
      "resolve",
      "--repo",
      this.state.repo,
      "--branch",
      options.branch,
      "--id",
      options.id,
    ])
  }

  runRemove(options: { readonly branch: string; readonly id: string }): Promise<CliResult> {
    this.state.tracer.cannotReplay("a thread removed from the command line")
    return this.run([
      "comment",
      "remove",
      "--repo",
      this.state.repo,
      "--branch",
      options.branch,
      "--id",
      options.id,
    ])
  }

  runRestore(options: { readonly branch: string; readonly id: string }): Promise<CliResult> {
    this.state.tracer.cannotReplay("a thread restored from the command line")
    return this.run([
      "comment",
      "restore",
      "--repo",
      this.state.repo,
      "--branch",
      options.branch,
      "--id",
      options.id,
    ])
  }

  runPane(
    options: {
      readonly env?: Readonly<Record<string, string>>
      readonly base?: string
    } = {},
  ): Promise<CliResult> {
    const base = options.base === undefined ? [] : ["--base", options.base]
    return this.run(["review", "pane", "--repo", this.state.repo, ...base], options.env ?? {})
  }

  runSkillRefresh(): Promise<CliResult> {
    return this.run(["skill", "refresh"], { HOME: this.state.workspace }, this.state.repo)
  }

  async writeOutside(name: string, contents: string): Promise<void> {
    const path = join(this.state.repo, name)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, contents, "utf8")
  }

  async makeRoomFor(name: string): Promise<void> {
    await mkdir(dirname(join(this.state.repo, name)), { recursive: true })
  }

  async installTheSkill(contents: string): Promise<void> {
    const path = join(this.state.repo, ".claude", "skills", "adiff", "SKILL.md")
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, contents, "utf8")
  }

  repoPath(): string {
    return this.state.repo
  }

  elsewhere(): string {
    return this.state.workspace
  }

  runDescribe(command?: string): Promise<CliResult> {
    return this.run(command === undefined ? ["describe"] : ["describe", "--command", command])
  }

  runTake(worktree: string, wait?: number): Promise<CliResult> {
    this.state.tracer.cannotReplay("a hand-over taken from the command line")
    const args = ["comment", "take", "--worktree", worktree]
    return this.run(wait === undefined ? args : [...args, "--wait", String(wait)])
  }

  runBranches(fields?: ReadonlyArray<string>): Promise<CliResult> {
    return this.run(["branch", "list", "--repo", this.state.repo, ...(fields ?? [])])
  }

  runVouch(options: { readonly branch: string; readonly file: string }): Promise<CliResult> {
    this.state.tracer.cannotReplay("a file vouched for from the command line")
    return this.run([
      "file",
      "review",
      "--repo",
      this.state.repo,
      "--branch",
      options.branch,
      "--file",
      options.file,
    ])
  }

  runReply(options: {
    readonly branch: string
    readonly to: string
    readonly body: string
  }): Promise<CliResult> {
    this.state.tracer.cannotReplay("a reply sent from the command line")
    return this.run([
      "comment",
      "reply",
      "--repo",
      this.state.repo,
      "--branch",
      options.branch,
      "--to",
      options.to,
      "--body",
      options.body,
    ])
  }

  runConfigList(): Promise<CliResult> {
    return this.run(["config", "list"])
  }

  runConfigGet(name: string): Promise<CliResult> {
    return this.run(["config", "get", "--name", name])
  }

  runConfigSet(name: string, value: boolean): Promise<CliResult> {
    this.state.tracer.cannotReplay("a preference set from the command line")
    return this.run(["config", "set", "--name", name, "--value", value ? "on" : "off"])
  }

  runProgress(branch: string): Promise<CliResult> {
    return this.run(["review", "progress", "--repo", this.state.repo, "--branch", branch])
  }

  runComment(options: CommentOptions): Promise<CliResult> {
    this.state.tracer.cannotReplay("a comment sent from the command line")
    return this.run([
      "comment",
      "send",
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
