import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/core.ts",
    before: ["alpha", "bravo", "charlie", "delta", "echo"],
    after: ["alpha", "BRAVO2", "charlie", "EPSILON"],
  },
]

type Delivered = {
  readonly body: string
  readonly file: string
  readonly side: string
  readonly start: number
  readonly end: number
  readonly snippet: string
}

type Range = { readonly start: number; readonly end: number; readonly side?: string }

const sent = async (driver: TestDriver, branch: string, range: Range): Promise<void> => {
  const { start, end, side } = range
  await driver.app.run([
    "comment",
    "send",
    "--repo",
    driver.repoPath,
    "--branch",
    branch,
    "--file",
    "src/core.ts",
    "--start",
    `${start}`,
    "--end",
    `${end}`,
    "--body",
    "why",
    ...(side === undefined ? [] : ["--side", side]),
  ])
}

describe("what a comment says it is about", () => {
  it("quotes only lines that are on the side it names", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await sent(driver, branch.name, { start: 1, end: 2 })

    // ASSERT
    const [one] = (await driver.agent.listComments(branch.worktree)) as ReadonlyArray<Delivered>
    expect(one?.side).toBe("new")
    expect(one?.snippet).not.toContain("bravo")
    expect(one?.snippet).toContain("BRAVO2")
  })

  it("keeps a deleted line out of a comment on the new side", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await sent(driver, branch.name, { start: 3, end: 4 })

    // ASSERT
    const [one] = (await driver.agent.listComments(branch.worktree)) as ReadonlyArray<Delivered>
    expect(one?.snippet).not.toContain("delta")
    expect(one?.snippet).not.toContain("echo")
    expect(one?.snippet).toContain("EPSILON")
  })

  it("stays on the old side when the old side was asked for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await sent(driver, branch.name, { start: 4, end: 5, side: "old" })

    // ASSERT
    const [one] = (await driver.agent.listComments(branch.worktree)) as ReadonlyArray<Delivered>
    expect(one?.side).toBe("old")
    expect(one?.snippet).toContain("delta")
    expect(one?.snippet).not.toContain("EPSILON")
  })
})
