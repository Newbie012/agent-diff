import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"
import { series, type Workspace } from "./workspace.ts"

const exec = promisify(execFile)
const ENTRY = fileURLToPath(new URL("../../bin/adiff.js", import.meta.url))

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

export const seedRemarks = async (space: Workspace): Promise<void> => {
  const env = { ...process.env, ADIFF_ROOT: space.storeRoot }
  await series(remarks, async (remark) => {
    const verb = remark.send ? "add" : "stage"
    await exec(
      ENTRY,
      [
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
      ],
      { env, encoding: "utf8" },
    ).catch(() => undefined)
  })
}
