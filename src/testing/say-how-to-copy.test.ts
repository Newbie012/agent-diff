import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
  ],
}

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(oneFile)
  await driver.screen.open({ width: 140, height: 20 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("copying what is selected", () => {
  it("says which key copies once a selection is under way", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    expect(await driver.screen.getFrame()).not.toContain("y copy")

    // ACT
    await driver.screen.pressKeys(["v", "j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("y copy")
  })
})
