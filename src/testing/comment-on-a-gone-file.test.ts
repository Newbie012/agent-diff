import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 150, height: 24 }

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/gone.ts", before: ["const g = 1"], after: ["const g = 1", "const h = 2"] },
  ],
}

const commentedThenGone = async (driver: TestDriver) => {
  const branch = await driver.branch.create(twoFiles)
  await driver.app.runComment({
    branch: branch.name,
    file: "src/gone.ts",
    start: 2,
    end: 2,
    body: "about a file that leaves",
  })
  await driver.branch.setFile(branch, "src/gone.ts", ["const g = 1"])
  await driver.screen.open({ ...WIDE, review: true })
  await driver.screen.pressKeys(["TAB"])
  return branch
}

describe("when a comment's file is no longer in the diff", () => {
  test("then the comment settles from the review panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedThenGone(driver)

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("settled")
  })

  test("then the comment is removed from the review panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedThenGone(driver)

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("removed")
  })

  test("then opening the comment shows where the file went", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedThenGone(driver)

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("not on this branch")
  })
})
