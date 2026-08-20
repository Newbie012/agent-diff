import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

describe("when adiff opens on a named branch", () => {
  test("then adiff says no worktree here is on that branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 120, height: 20, branch: "not-a-branch-here" })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no worktree here is on not-a-branch-here")
  })
})
