import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 160, height: 32 }

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
}

const commented = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create(oneFile)
  await driver.app.runComment({
    branch: branch.name,
    file: "src/api.ts",
    start: 2,
    end: 2,
    body: "why this one",
  })
  await driver.screen.open({ ...WIDE, review: true })
}

describe("when the diff is given the whole window", () => {
  test("then the file list and the review panel clear together", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commented(driver)
    const before = await driver.screen.getFrame()
    expect(before).toContain("Not picked up")
    expect(before).toContain("api.ts")

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Not picked up")
  })

  test("then zooming again brings both back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commented(driver)
    await driver.screen.pressKeys(["z"])

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Not picked up")
  })

  test("then a panel the reader shut stays shut", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commented(driver)
    await driver.screen.pressKeys(["a"])
    expect(await driver.screen.getFrame()).not.toContain("Not picked up")

    // ACT
    await driver.screen.pressKeys(["z", "z"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Not picked up")
  })

  test("then the footer names the key that hides the panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await commented(driver)

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n").filter((row) => row.trim().length > 0)
    expect(rows.at(-1) ?? "").toContain("a review")
  })
})
