import { rm } from "node:fs/promises"
import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  ],
}

describe("a branch with nothing left to read", () => {
  it("says so rather than counting a file out of none", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await rm(branch.worktree, { recursive: true, force: true })
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const header = (await driver.screen.getFrame()).split("\n").find((row) => row.trim()) ?? ""
    expect(header).not.toContain("file 1 of 0")
    expect(header).toContain("nothing to read")
  })
})
