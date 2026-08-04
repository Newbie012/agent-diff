import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

const pathRow = (frame: string): string =>
  frame.split("\n").find((row) => row.includes("worktree")) ?? ""

describe("naming the repository on the home screen", () => {
  it("keeps the path and the count on one line", async () => {
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

  it("elides the middle of a long path, keeping what identifies it", async () => {
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
