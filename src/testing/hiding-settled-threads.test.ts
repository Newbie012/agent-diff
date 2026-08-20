import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    { path: "src/api.ts", before: [], after: ["const first = 1", "const second = 2"] },
    { path: "src/web.ts", before: [], after: ["const third = 3", "const fourth = 4"] },
  ],
}

const openPanel = async (driver: TestDriver): Promise<void> => {
  await driver.screen.open({ width: 150, height: 24, review: true })
  await driver.screen.pressTab()
}

describe("when the settled threads are hidden", () => {
  test("then f hides the settled threads and f brings them back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "the older point",
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/web.ts",
      start: 1,
      end: 1,
      body: "the newer point",
    })
    await openPanel(driver)
    await driver.screen.pressKeys(["d"])
    expect(await driver.screen.getFrame()).toContain("the newer point")

    // ACT
    await driver.screen.pressKeys(["f"])
    const hidden = await driver.screen.getFrame()
    await driver.screen.pressKeys(["f"])

    // ASSERT
    expect(hidden).not.toContain("the newer point")
    expect(hidden).toContain("the older point")
    expect(await driver.screen.getFrame()).toContain("the newer point")
  })

  test("then the file list is untouched", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "the older point",
    })
    await openPanel(driver)
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["f"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("api.ts")
    expect(frame).toContain("web.ts")
  })
})
