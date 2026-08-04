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
    branch: "cdr-42-distinguish-missing-incidents",
    file: "src/api/incidents.ts",
    start: 12,
    end: 13,
    body: "Two throws where one union would do. Can these share a result type?",
    send: false,
  },
  {
    branch: "cdr-42-distinguish-missing-incidents",
    file: "src/api/errors.ts",
    start: 2,
    end: 4,
    body: "Worth carrying the tenant here too, otherwise the log line is ambiguous.",
    send: false,
  },
  {
    branch: "cdr-57-panel-handles-failure",
    file: "src/ui/IncidentPanel.tsx",
    start: 4,
    end: 5,
    body: "This renders before the retry lands. Does the empty state flash?",
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
