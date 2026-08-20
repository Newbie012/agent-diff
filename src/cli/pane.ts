import { execFile } from "node:child_process"
import { Effect } from "effect"

const TIMEOUT_MS = 5_000

export type PaneReport = {
  readonly opened: boolean
  readonly pane: string
  readonly command: string
}

type Splitter = {
  readonly pane: string
  readonly present: () => boolean
  readonly args: (repo: string, run: ReadonlyArray<string>) => ReadonlyArray<string>
  readonly binary: string
}

const set = (name: string): boolean => (process.env[name] ?? "").length > 0

const splitters: ReadonlyArray<Splitter> = [
  {
    pane: "tmux",
    binary: "tmux",
    present: () => set("TMUX"),
    args: (repo, run) => ["split-window", "-h", "-c", repo, ...run],
  },
  {
    pane: "zellij",
    binary: "zellij",
    present: () => set("ZELLIJ"),
    args: (repo, run) => ["action", "new-pane", "-d", "right", "--cwd", repo, "--", ...run],
  },
  {
    pane: "wezterm",
    binary: "wezterm",
    present: () => set("WEZTERM_PANE"),
    args: (repo, run) => ["cli", "split-pane", "--right", "--cwd", repo, "--", ...run],
  },
  {
    pane: "kitty",
    binary: "kitten",
    present: () => set("KITTY_LISTEN_ON"),
    args: (repo, run) => ["@", "launch", "--type=window", "--cwd", repo, ...run],
  },
]

const onBranch = (branch: string | undefined): ReadonlyArray<string> =>
  branch === undefined ? [] : ["--branch", branch]

const selfInvocation = (repo: string, branch: string | undefined): ReadonlyArray<string> => {
  const entry = process.argv[1]
  const head =
    entry === undefined ? ["adiff"] : [process.execPath, ...process.execArgv, entry]
  return [...head, "review", "open", "--repo", repo, ...onBranch(branch)]
}

const ran = (binary: string, args: ReadonlyArray<string>): Effect.Effect<boolean> =>
  Effect.callback<boolean>((resume) => {
    const child = execFile(binary, [...args], { timeout: TIMEOUT_MS }, (cause) =>
      resume(Effect.succeed(cause === null)),
    )
    return Effect.sync(() => void child.kill())
  })

const split = Effect.fn("Cli.split")(function* (
  chosen: Splitter,
  repo: string,
  branch: string | undefined,
) {
  return yield* ran(chosen.binary, chosen.args(repo, selfInvocation(repo, branch)))
})

export const openPane = Effect.fn("Cli.openPane")(function* (repo: string, branch?: string) {
  const command = `adiff review open --repo ${repo}${branch === undefined ? "" : ` --branch ${branch}`}`
  const chosen = splitters.find((candidate) => candidate.present())
  if (chosen === undefined) return { opened: false, pane: "none", command } satisfies PaneReport
  const opened = yield* split(chosen, repo, branch)
  return { opened, pane: chosen.pane, command } satisfies PaneReport
})
