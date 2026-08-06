import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const footer = (frame: string): string =>
  frame.split("\n").find((row) => row.includes("comment") || row.includes("settle")) ?? ""

const send = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText(body)
  await driver.screen.pressCtrl("s")
}

describe("the chips the cursor earns", () => {
  it("offers settling only once the cursor is on a thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await send(driver, "a point worth settling")

    // ASSERT
    expect(footer(await driver.screen.getFrame())).not.toContain("settle")

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(footer(await driver.screen.getFrame())).toContain("settle")
  })

  it("returns the reading chips when the cursor leaves the thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await send(driver, "a point worth settling")
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(footer(await driver.screen.getFrame())).not.toContain("settle")
  })
})
