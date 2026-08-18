import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const branchFiles = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
    {
      path: "src/web.ts",
      before: ["const held = 0"],
      after: ["const held = 0", "const second = 2"],
    },
  ],
}

const openWide = async (driver: TestDriver): Promise<void> => {
  await driver.screen.open({ width: 150, height: 24 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("a comment whose lines are no longer in the diff", () => {
  it("counts as read once the reviewer opens it from the panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(branchFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why is this here",
    })
    const listed = await driver.app.runThreads(branch.name)
    const id = (listed.envelope as { comments: ReadonlyArray<{ id: string }> }).comments[0]?.id ?? ""
    await driver.app.runAnswer({ worktree: branch.worktree, id, body: "because of the tests" })
    await driver.branch.setFile(branch, "src/api.ts", ["const keep = 0"])
    await openWide(driver)
    expect(await driver.screen.getFrame()).toContain("1 unread")

    // ACT
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("1 unread")
  })

  it("can still be settled from the panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(branchFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why is this here",
    })
    await driver.branch.setFile(branch, "src/api.ts", ["const keep = 0"])
    await openWide(driver)
    await driver.screen.pressTab()

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("settled")
  })
})
