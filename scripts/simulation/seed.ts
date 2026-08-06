import { execFile } from "node:child_process"
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { promisify } from "node:util"
import { NODE, runArgs } from "../lib/entry.ts"
import { series, type Workspace } from "./workspace.ts"

const exec = promisify(execFile)

export type Remark = {
  readonly branch: string
  readonly file: string
  readonly start: number
  readonly end: number
  readonly body: string
  readonly send: boolean
}

export const remarks: ReadonlyArray<Remark> = [
  {
    branch: "add-teammate-invitations",
    file: "src/api/invitations.ts",
    start: 12,
    end: 13,
    body: "Three status checks in a row. Can the server send one error shape instead?",
    send: false,
  },
  {
    branch: "add-teammate-invitations",
    file: "src/api/errors.ts",
    start: 2,
    end: 4,
    body: "Carry the team id here too, otherwise support cannot tell which team ran out.",
    send: false,
  },
  {
    branch: "show-invites-in-settings",
    file: "src/ui/InviteList.tsx",
    start: 4,
    end: 5,
    body: "The upgrade prompt renders before the retry lands. Does it flash on a slow network?",
    send: true,
  },
  {
    branch: "resend-expired-invites",
    file: "src/jobs/resend-invite.ts",
    start: 11,
    end: 13,
    body: "A resend on an expired token still reaches the mailer. Should the check come first?",
    send: true,
  },
  {
    branch: "resend-expired-invites",
    file: "src/api/invite-tokens.ts",
    start: 28,
    end: 28,
    body: "Twenty four hours is a lot shorter than before. Was that deliberate?",
    send: true,
  },
  {
    branch: "add-teammate-invitations",
    file: "src/api/errors.ts",
    start: 7,
    end: 7,
    body: "Does this one carry the seat count, or does support have to look it up?",
    send: true,
  },
]

const layers = {
  summary: "Invitations fail loudly, and the settings page can react",
  layers: [
    {
      title: "Give each way an invitation can fail its own error",
      note: "One thrown shape per failure, so a caller can tell a repeat invite from a team that has run out of seats without reading the status code.",
      spans: [{ path: "src/api/errors.ts", start: 1, end: 21 }],
    },
    {
      title: "Raise those errors from the invitation client",
      blocks: [
        {
          kind: "prose",
          markdown:
            "Every call checks the response before it returns, so a caller never reads a body that is not there.",
        },
        { kind: "code", path: "src/api/invitations.ts", start: 1, end: 9 },
        {
          kind: "prose",
          markdown:
            "A non-2xx that no case names raises Upstream carrying the status, so nothing fails silently.",
        },
        { kind: "code", path: "src/api/invitations.ts", start: 10, end: 17 },
        {
          kind: "prose",
          markdown:
            "The settings page has to say something for each failure, so the wording lives beside the errors it describes.",
        },
        { kind: "code", path: "docs/invitations.md", start: 1, end: 12 },
      ],
    },
  ],
}

const settingsLayers = {
  summary: "The settings page reads invitations, and the legacy client goes",
  layers: [
    {
      title: "List invitations with their state",
      note: "Each row carries the invitation's status, so a pending invite reads differently from one a teammate has already accepted.",
      spans: [{ path: "src/ui/InviteList.tsx", start: 1, end: 24 }],
    },
    {
      title: "Drop the client nothing calls any more",
      spans: [{ path: "src/api/legacy-invites.ts", start: 1, end: 40 }],
    },
  ],
}

const told: ReadonlyArray<{ branch: string; layers: unknown }> = [
  { branch: "add-teammate-invitations", layers },
  { branch: "show-invites-in-settings", layers: settingsLayers },
]

const answered: ReadonlyArray<{
  readonly branch: string
  readonly file: string
  readonly body: string
  readonly asks: boolean
  readonly settle: boolean
}> = [
  {
    branch: "show-invites-in-settings",
    file: "src/ui/InviteList.tsx",
    body: "Split it into a pending list and an accepted list, and gave each its own empty state.",
    asks: false,
    settle: true,
  },
  {
    branch: "resend-expired-invites",
    file: "src/jobs/resend-invite.ts",
    body: "Held the send behind the same token check, so a resend cannot outlive the invitation it belongs to.",
    asks: false,
    settle: false,
  },
  {
    branch: "resend-expired-invites",
    file: "src/api/invite-tokens.ts",
    body: "It was, to match the mailer's own expiry. Twelve hours would match support's runbook instead. Which do you want?",
    asks: true,
    settle: false,
  },
]

const branchesAnswered: ReadonlyArray<string> = [
  ...new Set(answered.map((entry) => entry.branch)),
]

const speak = async (
  space: Workspace,
  worktree: string,
  entry: (typeof answered)[number],
  id: string,
): Promise<void> => {
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  await exec(
    NODE,
    runArgs([
      "comment",
      "answer",
      "--worktree",
      worktree,
      "--id",
      id,
      "--body",
      entry.body,
      ...(entry.asks ? ["--asks"] : []),
    ]),
    { env, encoding: "utf8" },
  ).catch(() => undefined)
  if (!entry.settle) return
  await exec(
    NODE,
    runArgs(["comment", "resolve", "--repo", space.repo, "--branch", entry.branch, "--id", id]),
    { env, encoding: "utf8" },
  ).catch(() => undefined)
}

type Handed = { readonly id: string; readonly file: string }

type Spoken = { readonly entry: (typeof answered)[number]; readonly id: string }

const matched = (handed: ReadonlyArray<Handed>, file: string): Handed | undefined =>
  handed.find((candidate) => candidate.file === file)

const spokenFor = (name: string, handed: ReadonlyArray<Handed>): ReadonlyArray<Spoken> =>
  answered
    .filter((entry) => entry.branch === name)
    .flatMap((entry) => {
      const found = matched(handed, entry.file)
      return found === undefined ? [] : [{ entry, id: found.id }]
    })

export const seedAnswers = async (space: Workspace): Promise<void> => {
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  await series(branchesAnswered, async (name) => {
    const branch = space.branches.find((candidate) => candidate.name === name)
    if (branch === undefined) return
    const taken = await exec(NODE, runArgs(["comment", "take", "--worktree", branch.worktree]), {
      env,
      encoding: "utf8",
    }).catch(() => undefined)
    if (taken === undefined) return
    const handed = (
      JSON.parse(taken.stdout) as { comments: ReadonlyArray<Handed> }
    ).comments
    const spoken = spokenFor(name, handed)
    await series(spoken, (each) => speak(space, branch.worktree, each.entry, each.id))
  })
}

const drift = {
  branch: "show-invites-in-settings",
  path: "src/ui/InviteList.tsx",
  added: [
    "",
    "export function InviteCount({ team }: { team: string }) {",
    "  const { data } = useInvitations(team)",
    "  return <span>{data?.length ?? 0} invited</span>",
    "}",
  ],
  message: "agent: count the invitations for the header",
}

export const seedDrift = async (space: Workspace): Promise<void> => {
  const branch = space.branches.find((candidate) => candidate.name === drift.branch)
  if (branch === undefined) return
  const path = join(branch.worktree, drift.path)
  const held = await readFile(path, "utf8").catch(() => undefined)
  if (held === undefined) return
  await writeFile(path, `${held}${drift.added.join("\n")}\n`, "utf8")
  await exec("git", ["add", "-A"], { cwd: branch.worktree })
  await exec("git", ["commit", "-q", "-m", drift.message], { cwd: branch.worktree })
}

export const seedLayers = async (space: Workspace): Promise<void> => {
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  await series(told, async (entry) => {
    const branch = space.branches.find((candidate) => candidate.name === entry.branch)
    if (branch === undefined) return
    const child = execFile(
      NODE,
      runArgs(["layers", "set", "--worktree", branch.worktree, "--json", "-"]),
      { env, encoding: "utf8" },
    )
    child.stdin?.end(JSON.stringify(entry.layers))
    await new Promise((resolve) => child.on("close", resolve))
  })
}

export const seedRemarks = async (space: Workspace): Promise<void> => {
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  await series(remarks, async (remark) => {
    const verb = remark.send ? "add" : "stage"
    await exec(
      NODE,
      runArgs([
        "comment",
        verb,
        "--repo",
        space.repo,
        "--branch",
        remark.branch,
        "--file",
        remark.file,
        "--start",
        String(remark.start),
        "--end",
        String(remark.end),
        "--body",
        remark.body,
      ]),
      { env, encoding: "utf8" },
    ).catch(() => undefined)
  })
}

export const seedDemo = async (space: Workspace): Promise<void> => {
  await seedRemarks(space)
  await seedLayers(space)
  await seedAnswers(space)
  await seedDrift(space)
}

export const answerLive = async (space: Workspace, name: string): Promise<void> => {
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  const branch = space.branches.find((candidate) => candidate.name === name)
  if (branch === undefined) return
  const taken = await exec(NODE, runArgs(["comment", "take", "--worktree", branch.worktree]), {
    env,
    encoding: "utf8",
  }).catch(() => undefined)
  if (taken === undefined) return
  const handed = (JSON.parse(taken.stdout) as { comments: ReadonlyArray<{ id: string }> }).comments
  const first = handed[0]
  if (first === undefined) return
  await exec(
    NODE,
    runArgs([
      "comment",
      "answer",
      "--worktree",
      branch.worktree,
      "--id",
      first.id,
      "--body",
      "It carries the seat count on the error, so support reads one field rather than looking it up.",
    ]),
    { env, encoding: "utf8" },
  ).catch(() => undefined)
}
