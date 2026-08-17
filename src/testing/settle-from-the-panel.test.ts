import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 160, height: 32 }

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
    {
      path: "src/web.ts",
      before: ["const w = 1"],
      after: ["const w = 1", "const x = 2", "const y = 3"],
    },
  ],
}

const commentedElsewhere = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create(twoFiles)
  await driver.app.runComment({
    branch: branch.name,
    file: "src/web.ts",
    start: 2,
    end: 2,
    body: "this one is off screen",
  })
  await driver.screen.open(WIDE)
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["TAB"])
}

describe("a comment the diff cannot reach", () => {
  it("settles from the review panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedElsewhere(driver)

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("settled")
  })

  it("is removed from the review panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commentedElsewhere(driver)

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("removed")
  })

  it("offers the key that settles it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await commentedElsewhere(driver)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("settle")
  })
})
