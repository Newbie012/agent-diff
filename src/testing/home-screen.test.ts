import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  ],
}

describe("when adiff opens on the home screen", () => {
  test("then the home screen names the repository being reviewed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("repo")
  })

  test("then the worktree list is headed with its columns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    const frame = await driver.screen.getFrame()
    const heading = frame.split("\n").find((row) => row.includes("WORKTREE")) ?? ""
    expect(heading).toContain("FILES")
    expect(heading).toContain("STATE")
  })

  test("then what was added is split from what was taken away", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    const row = (await driver.screen.getFrame()).split("\n").find((line) => line.includes(created.name)) ?? ""
    expect(row).toContain("+1")
    expect(row).toContain("-0")
  })
})
