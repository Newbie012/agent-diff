import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

const pathRow = (frame: string): string =>
  frame.split("\n").find((row) => row.includes("worktree")) ?? ""

const tableRow = (frame: string, name: string): string =>
  frame
    .split("\n")
    .filter((row) => !row.includes("worktrees"))
    .find((row) => new RegExp(`${name}\\s`).test(row) && row.includes("+")) ?? ""

describe("naming the repository it opened", () => {
  it("shows a path even when the argument is a dot", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ repo: `${branch.worktree}/.` })

    // ASSERT
    const row = pathRow(await driver.screen.getFrame()).trim()
    expect(row.startsWith("/") || row.startsWith("~")).toBe(true)
    expect(row).not.toContain("/.")
  })

  it("resolves a path that walks back up through a parent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ repo: `${branch.worktree}/../${branch.name}` })

    // ASSERT
    expect(pathRow(await driver.screen.getFrame())).not.toContain("..")
  })
})

describe("marking the worktree the reader opened", () => {
  it("marks the worktree the repository argument names", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const first = await driver.branch.create(oneFile)
    const second = await driver.branch.create({ ...oneFile, name: "second-branch" })

    // ACT
    await driver.screen.open({ repo: second.worktree })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(tableRow(frame, second.name)).toContain("here")
    expect(tableRow(frame, first.name)).not.toContain("here")
  })
})
