import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const one = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const stage = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText(body)
  await driver.screen.pressCtrl("a")
}

describe("finding a command from the review list", () => {
  it("opens the palette over the list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(one)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await stage(driver, "worth a look")
    await driver.screen.pressKeys(["S"])

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Commands")
    expect(frame).toContain("Withdraw")
  })

  it("comes back to the list when dismissed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(one)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await stage(driver, "worth a look")
    await driver.screen.pressKeys(["S"])
    await driver.screen.pressCtrl("p")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("worth a look")
    expect(frame).not.toContain("Commands")
  })
})
