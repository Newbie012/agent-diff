import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { DriverState } from "../../state.ts"

export type PullOnForge = {
  readonly branch: string
  readonly number?: number
  readonly head?: string
  readonly url?: string
}

export type ForgeOptions = {
  readonly refuses?: boolean
  readonly reason?: string
}

export type PostedReview = {
  readonly event: string
  readonly comments: ReadonlyArray<{
    readonly path: string
    readonly line: number
    readonly side: string
    readonly body: string
  }>
}

const OWNER = "someone/their-repo"

const scriptFor = (
  pulls: ReadonlyArray<PullOnForge>,
  posted: string,
  options: ForgeOptions,
): string => {
  const rows = pulls.map((pull) => ({
    headRefName: pull.branch,
    state: "OPEN",
    isDraft: false,
  }))
  const named = Object.fromEntries(
    pulls.map((pull, at) => [
      pull.branch,
      {
        number: pull.number ?? at + 1,
        headRefOid: pull.head ?? "headcommit",
        url: pull.url ?? `https://forge.test/${OWNER}/pull/${pull.number ?? at + 1}`,
      },
    ]),
  )
  const refuse = options.refuses === true
  return [
    "#!/bin/sh",
    'if [ "$1" = "pr" ] && [ "$2" = "list" ]; then',
    `cat <<'JSON'`,
    JSON.stringify(rows),
    "JSON",
    "exit 0",
    "fi",
    'if [ "$1" = "pr" ] && [ "$2" = "view" ]; then',
    `node -e 'const named = ${JSON.stringify(JSON.stringify(named))}; const one = JSON.parse(named)[process.argv[1]]; if (one === undefined) { process.exit(1) } process.stdout.write(JSON.stringify(one))' "$3"`,
    "exit $?",
    "fi",
    'if [ "$1" = "repo" ] && [ "$2" = "view" ]; then',
    `printf '%s\\n' '${OWNER}'`,
    "exit 0",
    "fi",
    'if [ "$1" = "api" ]; then',
    `cat > "${posted}"`,
    refuse ? `echo '${options.reason ?? "the forge said no"}' >&2` : "",
    refuse ? "exit 1" : "printf '{}'",
    "exit 0",
    "fi",
    "exit 1",
  ]
    .filter((line) => line.length > 0)
    .join("\n")
}

export class ForgeTestDriver {
  private readonly state: DriverState

  constructor(state: DriverState) {
    this.state = state
  }

  private postedPath(): string {
    return join(this.state.workspace, "bin", "posted.json")
  }

  async holds(pulls: ReadonlyArray<PullOnForge>, options: ForgeOptions = {}): Promise<void> {
    const bin = join(this.state.workspace, "bin")
    await mkdir(bin, { recursive: true })
    const path = join(bin, "gh")
    await writeFile(path, `${scriptFor(pulls, this.postedPath(), options)}\n`, { mode: 0o755 })
    process.env["PATH"] = `${bin}:${process.env["PATH"] ?? ""}`
  }

  async posted(): Promise<PostedReview | undefined> {
    const raw = await readFile(this.postedPath(), "utf8").catch(() => "")
    return raw.trim().length === 0 ? undefined : (JSON.parse(raw) as PostedReview)
  }
}
