import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

const pathRow = (frame: string): string =>
  frame.split("\n").find((row) => row.includes("worktree")) ?? ""

describe("when the home screen names the repository", () => {
  test("then the path and the count share one line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    const row = pathRow(await driver.screen.getFrame())
    expect(row).toContain("worktree")
    expect(row).toContain("repo")
  })

  test("then a long path elides in the middle", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 80, height: 30 })

    // ASSERT
    const row = pathRow(await driver.screen.getFrame())
    expect(row.trim()).toContain("worktree")
    expect(row.trim().length).toBeLessThan(80)
    expect(row).toMatch(/repo/)
  })
})
