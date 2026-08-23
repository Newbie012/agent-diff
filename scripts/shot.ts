import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { argv, exit, stderr, stdout } from "node:process"
import { traceNamed } from "./scenario.ts"
import { narrate } from "./lib/narrate.ts"
import type { Beat, Where } from "./lib/narrate.ts"
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
const tokensIn = (said: string): ReadonlyArray<string> =>
  said.startsWith("text:") ? [said] : said.split(" ").filter((token) => token.length > 0)

const asked = argv.flatMap((arg, at) => (arg === "--keys" ? tokensIn(argv[at + 1] ?? "") : []))

const keys = chosen === undefined ? asked : chosen.steps.flatMap((step) => step.keys)
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
  const session = `adiff-${createHash("sha256").update(`${name}-still`).digest("hex").slice(0, 10)}`
  run("termctrl", [
    "start", session,
    "--cols", String(cols),
    "--rows", String(rows),
    "--",
    "node", ...NODE, ...bootArgs(root),
  ])
  try {
    run("termctrl", ["wait", session, wanted, "--timeout", "40000"])
    execFileSync("sleep", ["0.4"])
    for (const key of keys) sendOne(session, key)
    execFileSync("sleep", ["1"])
    run("termctrl", [
      "save", session,
      "--format", "png",
      "--out", out,
      "--hide-cursor",
      "--settle-ms", "1000",
    ])
  } finally {
    run("termctrl", ["stop", session])
  }
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
    run("termctrl", ["wait", session, "--timeout", "20000", "--", key.slice("until:".length)])
    return
  }
  run("termctrl", ["send", session, "--pace-ms", "120", key])
}

const SHOWN: Readonly<Record<string, string>> = {
  enter: "return",
  escape: "esc",
  tab: "tab",
  "shift-tab": "shift tab",
  up: "up",
  down: "down",
  left: "left",
  right: "right",
}

const keyShown = (token: string): string | undefined => {
  if (/^(wait|until):/.test(token)) return undefined
  if (token.startsWith("text:")) {
    const said = token.slice("text:".length)
    return said.length === 1 ? said : "typing"
  }
  return SHOWN[token] ?? token.replace("ctrl-", "ctrl ")
}

type Marked = {
  readonly kind: "step" | "check" | "key"
  readonly does: string
  readonly name: string
  readonly where?: Where
}

const typedOut = (
  session: string,
  key: string,
  tag: string,
  marks: Array<Marked>,
): void => {
  const shown = keyShown(key)
  if (shown !== undefined) {
    run("termctrl", ["mark", session, tag])
    marks.push({ kind: "key", does: shown, name: tag })
  }
  sendOne(session, key)
}

const played = (session: string, held: Trace | undefined): ReadonlyArray<Marked> => {
  if (held === undefined) {
    for (const key of keys) sendOne(session, key)
    return []
  }
  const marks: Array<Marked> = []
  for (const [at, moment] of held.moments.entries()) {
    const name = `m${at}`
    run("termctrl", ["mark", session, name])
    marks.push({
      kind: moment.kind,
      does: moment.does,
      name,
      ...(moment.kind === "check" && moment.where !== undefined ? { where: moment.where } : {}),
    })
    if (moment.kind === "step") {
      moment.keys.forEach((key, each) => typedOut(session, key, `${name}k${each}`, marks))
      execFileSync("sleep", [String(pace / 1000)])
      continue
    }
    execFileSync("sleep", [String(hold / 1000)])
  }
  return marks
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
  let marks: ReadonlyArray<Marked> = []
  try {
    run("termctrl", ["wait", session, wanted, "--timeout", "40000"])
    execFileSync("sleep", ["0.4"])
    run("termctrl", ["mark", session, "ready"])
    marks = played(session, chosen)
    run("termctrl", ["mark", session, "done"])
  } finally {
    run("termctrl", ["stop", session])
  }
  writeFileSync(plan, JSON.stringify({ clips: [{ from: "ready", to: "done" }] }), "utf8")
  const raw = join(shots, `${name}-raw.mp4`)
  run("termctrl", [
    "video", tape,
    "-o", raw,
    "--hide-cursor",
    "--tail-ms", "1200",
    "--padding", "0",
    "--edit", plan,
  ])
  if (chosen === undefined || marks.length === 0) {
    rmSync(tape, { force: true })
    rmSync(plan, { force: true })
    return raw
  }
  const clock = timesIn(tape)
  const started = clock["ready"] ?? 0
  const shut = clock["done"] ?? 0
  const timeOf = (tag: string): number => ((clock[tag] ?? started) - started) / 1000

  const endsAt = (mark: Marked, at: number): number => {
    const after = marks.slice(at + 1)
    const next = mark.kind === "key" ? after[0] : after.find((one) => one.kind !== "key")
    return next === undefined ? (shut - started) / 1000 : timeOf(next.name)
  }

  const beatOf = (mark: Marked, at: number): Beat => {
    const held: Beat = {
      kind: mark.kind,
      does: mark.does,
      from: timeOf(mark.name),
      to: endsAt(mark, at),
    }
    return mark.where === undefined ? held : { ...held, where: mark.where }
  }
  const beats = marks.map(beatOf)
  const at = chosen.test.lastIndexOf(" > ")
  narrate(raw, out, {
    seat: { cols, rows },
    asks: at === -1 ? chosen.test : chosen.test.slice(0, at),
    proves: at === -1 ? "" : chosen.test.slice(at + 3),
    beats,
    lead: 2.5,
  })
  rmSync(tape, { force: true })
  rmSync(plan, { force: true })
  rmSync(raw, { force: true })
  return out
}

const timesIn = (tape: string): Readonly<Record<string, number>> => {
  const said = run("termctrl", ["markers", tape, "--json"])
  const found = JSON.parse(said) as ReadonlyArray<{ at_ms: number; name: string }>
  return Object.fromEntries(found.map((one) => [one.name, one.at_ms]))
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
