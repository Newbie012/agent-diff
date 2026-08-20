import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { argv, exit, stderr, stdout } from "node:process"
import { traceNamed } from "./scenario.ts"
import type { Trace } from "../src/testing/scenario/index.ts"

const SIM = "scripts/simulate.ts"
const SCENARIO = "scripts/scenario.ts"
const NODE = ["--experimental-ffi", "--disable-warning=ExperimentalWarning"]

const value = (name: string): string | undefined => {
  const at = argv.indexOf(`--${name}`)
  return at === -1 ? undefined : argv[at + 1]
}

const number = (name: string, fallback: number): number => {
  const said = value(name)
  return said === undefined ? fallback : Number(said)
}

const pace = number("pace", 1000)
const hold = number("hold", 1200)
const traceAt = value("trace")
const testName = value("test-name")
const chosen =
  traceAt === undefined || testName === undefined ? undefined : traceNamed(traceAt, testName)
const cols = number("cols", chosen?.seat.width ?? 120)
const rows = number("rows", chosen?.seat.height ?? 32)
const keys =
  chosen === undefined
    ? (value("keys") ?? "").split(" ").filter((token) => token.length > 0)
    : chosen.steps.flatMap((step) => step.keys)
const label = value("label") ?? chosen?.test ?? "after"
const against = value("against")
const wanted = value("wait-for") ?? "WORKTREE"
const filming = argv.includes("--video")
const keeping = argv.includes("--keep")

const run = (command: string, args: ReadonlyArray<string>): string =>
  execFileSync(command, [...args], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }).trim()

const git = (...args: ReadonlyArray<string>): string => run("git", args)

try {
  run("which", ["termctrl"])
} catch {
  stderr.write(
    "termctrl is not on PATH. Install it with `cargo install --locked terminal-control`, then run this again.\n",
  )
  exit(1)
}

const slug = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
const shots = "shots"
mkdirSync(shots, { recursive: true })

const stillAt = (root: string, name: string): string => {
  const out = join(shots, `${name}.png`)
  run("termctrl", [
    "save",
    "--format", "png",
    "--out", out,
    "--cols", String(cols),
    "--rows", String(rows),
    "--hide-cursor",
    "--settle-ms", "3000",
    "--deadline-ms", "40000",
    "--wait-for", wanted,
    ...keys.filter((key) => !/^(wait|until):/.test(key)).flatMap((key) => ["-s", key]),
    "--",
    "node", ...NODE, ...bootArgs(root),
  ])
  return out
}

const bootArgs = (root: string): ReadonlyArray<string> =>
  chosen === undefined || traceAt === undefined || testName === undefined
    ? [join(root, SIM)]
    : [join(root, SCENARIO), traceAt, testName]

const sendOne = (session: string, key: string): void => {
  if (key.startsWith("wait:")) {
    execFileSync("sleep", [String(Number(key.slice("wait:".length)) / 1000)])
    return
  }
  if (key.startsWith("until:")) {
    run("termctrl", ["wait", session, key.slice("until:".length), "--timeout", "20000"])
    return
  }
  run("termctrl", ["send", session, "--pace-ms", "120", key])
}

type Clip = { readonly from: string; readonly to: string; readonly caption?: string }

const played = (session: string, held: Trace | undefined): ReadonlyArray<Clip> => {
  if (held === undefined) {
    for (const key of keys) sendOne(session, key)
    return []
  }
  const clips: Array<Clip> = []
  let last = "ready"
  let at = 0
  for (const moment of held.moments) {
    if (moment.kind === "step") {
      for (const key of moment.keys) sendOne(session, key)
      execFileSync("sleep", [String(pace / 1000)])
      continue
    }
    at += 1
    const mark = `check${at}`
    run("termctrl", ["mark", session, mark])
    clips.push({ from: last, to: mark, caption: moment.does })
    execFileSync("sleep", [String(hold / 1000)])
    last = mark
  }
  return clips
}

const filmAt = (root: string, name: string): string => {
  const tape = join(shots, `${name}.termctrl`)
  const out = join(shots, `${name}.mp4`)
  const session = `adiff-${createHash("sha256").update(name).digest("hex").slice(0, 10)}`
  run("termctrl", [
    "start", session,
    "--record", tape,
    "--cols", String(cols),
    "--rows", String(rows),
    "--",
    "node", ...NODE, ...bootArgs(root),
  ])
  const plan = join(shots, `${name}.json`)
  let clips: ReadonlyArray<Clip> = []
  try {
    run("termctrl", ["wait", session, wanted, "--timeout", "40000"])
    execFileSync("sleep", ["0.4"])
    run("termctrl", ["mark", session, "ready"])
    clips = played(session, chosen)
    run("termctrl", ["mark", session, "done"])
  } finally {
    run("termctrl", ["stop", session])
  }
  const whole =
    clips.length === 0
      ? [{ from: "ready", to: "done" }]
      : [...clips, { from: clips.at(-1)?.to ?? "ready", to: "done" }]
  writeFileSync(plan, JSON.stringify({ clips: whole }), "utf8")
  run("termctrl", [
    "video", tape,
    "-o", out,
    "--hide-cursor",
    "--tail-ms", "1200",
    "--edit", plan,
    "--footer",
  ])
  rmSync(tape, { force: true })
  rmSync(plan, { force: true })
  return out
}

const atBase = (commit: string, name: string): string => {
  const root = git("rev-parse", "--show-toplevel")
  const where = mkdtempSync(join(tmpdir(), "adiff-shot-"))
  const tree = join(where, "tree")
  try {
    git("worktree", "add", "--detach", tree, commit)
    symlinkSync(join(root, "node_modules"), join(tree, "node_modules"))
    return stillAt(tree, name)
  } finally {
    git("worktree", "remove", "--force", tree)
    rmSync(where, { recursive: true, force: true })
  }
}

const uploaded = (path: string): string => {
  const said = run("gh", ["image", "--repo", run("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]), path])
  const found = /\((?<url>https:\/\/github\.com\/user-attachments\/assets\/[^)]+)\)/.exec(said)
  if (found?.groups?.["url"] === undefined) {
    stderr.write(
      `gh image did not return a user-attachments URL. It said:\n${said}\nRun \`gh image check-token\`, and install it with \`gh extension install drogers0/gh-image\` if it is missing.\n`,
    )
    exit(1)
  }
  return found.groups["url"]
}

const here = git("rev-parse", "--show-toplevel")

if (filming) {
  const film = filmAt(here, slug)
  stdout.write(`\n${uploaded(film)}\n`)
  if (!keeping) rmSync(film, { force: true })
  exit(0)
}

const after = stillAt(here, `${slug}-after`)

if (against === undefined) {
  stdout.write(`\n![${label}](${uploaded(after)})\n`)
  if (!keeping) rmSync(after, { force: true })
  exit(0)
}

const before = atBase(git("merge-base", "HEAD", against), `${slug}-before`)

if (readFileSync(before).equals(readFileSync(after))) {
  stderr.write(
    `The screen at the merge base is pixel-identical to the one here, so these keys do not reach what this branch changed. Press the keys that get to it, or leave the before and after out.\n`,
  )
  if (!keeping) {
    rmSync(before, { force: true })
    rmSync(after, { force: true })
  }
  exit(1)
}

stdout.write(
  [
    "",
    "<table>",
    "<tr><th>Before</th><th>After</th></tr>",
    "<tr>",
    `<td><img src="${uploaded(before)}" alt="before"></td>`,
    `<td><img src="${uploaded(after)}" alt="after"></td>`,
    "</tr>",
    "</table>",
    "",
  ].join("\n"),
)

if (!keeping) {
  rmSync(before, { force: true })
  rmSync(after, { force: true })
}
