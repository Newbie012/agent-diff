import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  ],
}

describe("the screen you land on", () => {
  it("says which repository you are reviewing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("repo")
  })

  it("heads the worktree list with its columns", async () => {
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

  it("splits what was added from what was taken away", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    const row = (await driver.screen.getFrame()).split("\n").find((line) => line.includes("add-invitations")) ?? ""
    expect(row).toContain("+1")
    expect(row).toContain("-0")
  })
})
