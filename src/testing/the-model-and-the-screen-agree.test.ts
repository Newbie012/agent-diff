import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 80 }, (_, at) => `  const step${at} = ${at};`)

const file = {
  files: [{ path: "src/long.ts", before: ["export function held() {"], after: ["export function held() {", ...body, "}"] }],
}

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(file)
  await driver.screen.open({ width: 110, height: 20 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("what the review believes and what it draws", () => {
  it("agree after the wheel has moved the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.scroll("down", 8)

    // ASSERT
    const believed = await driver.screen.believes()
    expect(believed.scroll).toBeGreaterThan(0)
    expect(await driver.screen.paintedTop()).toBe(believed.scroll)
  })

  it("agree again after a key follows the wheel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.scroll("down", 8)
    const before = await driver.screen.paintedTop()

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const after = await driver.screen.paintedTop()
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
  })
})
