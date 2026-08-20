import { describe, expect, test } from "@effect/vitest"
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

describe("when the mouse puts the cursor on a line", () => {
  test("then no selection starts", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ACT
    await driver.screen.clickOnLine("const step6 = 6;")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toMatch(/\d+ lines?\s/)
  })

  test("then the diff stays put while the arrows move inside it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.screen.clickOnLine("const step6 = 6;")
    const before = await driver.screen.paintedTop()
    const landed = (await driver.screen.believes()).cursor

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN", "ARROW_DOWN", "ARROW_UP"])

    // ASSERT
    expect((await driver.screen.believes()).cursor).toBe(landed + 1)
    expect(await driver.screen.paintedTop()).toBe(before)
  })

  test("then the diff follows the cursor once it leaves the pane", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.screen.clickOnLine("const step6 = 6;")
    const before = await driver.screen.paintedTop()

    // ACT
    await driver.screen.pressKeys(Array.from({ length: 40 }, () => "ARROW_DOWN"))

    // ASSERT
    expect(await driver.screen.paintedTop()).toBeGreaterThan(before)
  })
})
