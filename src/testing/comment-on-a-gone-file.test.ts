import { describe, expect, it } from "@effect/vitest"
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
  await driver.screen.open(WIDE)
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["TAB"])
  return branch
}

describe("a comment whose file is no longer in the diff", () => {
  it("settles from the review panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedThenGone(driver)

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("settled")
  })

  it("is removed from the review panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedThenGone(driver)

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("withdrawn")
  })

  it("says where it went when opened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedThenGone(driver)

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("not on this branch")
  })
})
