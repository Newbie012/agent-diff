import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 200 }, (_, at) => `  const step${at} = ${at};`)

const tall = {
  files: [
    {
      path: "src/tall.ts",
      before: ["export function held() {"],
      after: ["export function held() {", ...body, "}"],
    },
  ],
}

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(tall)
  await driver.screen.open({ width: 120, height: 30 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("putting the cursor on a line with the mouse", () => {
  it("does not start a selection", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.clickOnDiff(12)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toMatch(/\d+ lines?\s/)
  })

  it("leaves the diff where it is when the arrows move inside it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.clickOnDiff(12)
    const before = await driver.screen.paintedTop()
    const landed = (await driver.screen.believes()).cursor

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN", "ARROW_DOWN", "ARROW_UP"])

    // ASSERT
    expect((await driver.screen.believes()).cursor).toBe(landed + 1)
    expect(await driver.screen.paintedTop()).toBe(before)
  })

  it("still follows the cursor once it leaves the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.clickOnDiff(12)
    const before = await driver.screen.paintedTop()

    // ACT
    await driver.screen.pressKeys([...Array.from({ length: 40 }, () => "ARROW_DOWN")])

    // ASSERT
    expect(await driver.screen.paintedTop()).toBeGreaterThan(before)
  })
})
