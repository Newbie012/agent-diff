import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
}

const story = {
  summary: "One step",
  steps: [{ title: "Add the second line", spans: [{ path: "src/api.ts", start: 2, end: 2 }] }],
}

describe("a story the branch has moved past", () => {
  it("says so on the worktree list and in the rail", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runStorySet(branch.worktree, story)
    await driver.branch.setFile(branch, "src/api.ts", ["const a = 1", "const b = 2", "const c = 3"])
    await driver.branch.commitAll(branch, "add a third line")

    // ACT
    await driver.screen.open()

    // ASSERT
    const home = await driver.screen.getFrame()
    expect(home).toContain("stale")

    await driver.screen.pressKeys(["RETURN"])
    expect(await driver.screen.getFrame()).toContain("stale")
  })
})
