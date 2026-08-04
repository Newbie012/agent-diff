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
