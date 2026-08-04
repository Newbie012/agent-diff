import { execFile } from "node:child_process"
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
]

const story = {
  summary: "Invitations fail loudly, and the settings page can react",
  steps: [
    {
      title: "Give each way an invitation can fail its own error",
      note: "One thrown shape per failure, so a caller can tell a repeat invite from a team that has run out of seats without reading the status code.",
      spans: [{ path: "src/api/errors.ts", start: 1, end: 21 }],
    },
    {
      title: "Raise those errors from the invitation client",
      note: "Every call now checks the response. A non-2xx that no case names raises Upstream carrying the status, so nothing fails silently.",
      spans: [{ path: "src/api/invitations.ts", start: 1, end: 17 }],
    },
    {
      title: "Write down what the settings page should do with each one",
      spans: [{ path: "docs/invitations.md", start: 1, end: 12 }],
    },
  ],
}

export const seedStory = async (space: Workspace): Promise<void> => {
  const branch = space.branches.find((entry) => entry.name === "add-teammate-invitations")
  if (branch === undefined) return
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  const child = execFile(
    NODE,
    runArgs(["story", "set", "--worktree", branch.worktree, "--json", "-"]),
    { env, encoding: "utf8" },
  )
  child.stdin?.end(JSON.stringify(story))
  await new Promise((resolve) => child.on("close", resolve))
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
