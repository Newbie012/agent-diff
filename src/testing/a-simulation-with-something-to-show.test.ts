import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { describe, expect, test } from "@effect/vitest"
import { NODE, runArgs } from "../../scripts/lib/entry.ts"
import { seedDemo } from "../../scripts/simulation/seed.ts"
import { createWorkspace, type Workspace } from "../../scripts/simulation/workspace.ts"

const exec = promisify(execFile)

type Thread = { readonly answers: ReadonlyArray<string> }

const read = async (space: Workspace, args: ReadonlyArray<string>): Promise<unknown> => {
  const { stdout } = await exec(NODE, runArgs(args), {
    cwd: space.repo,
    env: { ...process.env, ADIFF_ROOT: space.storeRoot },
    encoding: "utf8",
  })
  const line = stdout.split("\n").findLast((candidate) => candidate.startsWith("{"))
  return line === undefined ? undefined : JSON.parse(line)
}

const threadsOn = async (space: Workspace, worktree: string): Promise<ReadonlyArray<Thread>> => {
  const said = (await read(space, ["comment", "list", "--worktree", worktree])) as
    | { readonly comments?: ReadonlyArray<Thread> }
    | undefined
  return said?.comments ?? []
}

const draftsOn = async (space: Workspace, worktree: string): Promise<ReadonlyArray<unknown>> => {
  const said = (await read(space, ["draft", "list", "--worktree", worktree])) as
    | { readonly drafts?: ReadonlyArray<unknown> }
    | undefined
  return said?.drafts ?? []
}

describe("when the simulation seeds its demo", () => {
  test("then every branch of the synthetic repo holds the comments, answers and drafts it was seeded with", async () => {
    // ARRANGE
    const space = await createWorkspace({ branches: 3 })

    // ACT
    await seedDemo(space)
    const threads = await Promise.all(space.branches.map((one) => threadsOn(space, one.worktree)))
    const drafts = await Promise.all(space.branches.map((one) => draftsOn(space, one.worktree)))

    // ASSERT
    expect(threads.flat().length).toBeGreaterThan(0)
    expect(threads.flat().filter((one) => one.answers.length > 0).length).toBeGreaterThan(0)
    expect(drafts.flat().length).toBeGreaterThan(0)
    await space.dispose()
  }, 120_000)
})
