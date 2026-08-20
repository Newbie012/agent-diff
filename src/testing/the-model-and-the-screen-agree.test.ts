import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 80 }, (_, at) => `  const step${at} = ${at};`)

const file = {
  files: [{ path: "src/long.ts", before: ["export function held() {"], after: ["export function held() {", ...body, "}"] }],
}

describe("when the wheel and a key move the diff", () => {
  test("then what the review believes matches what it draws", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 110, height: 20, review: true })

    // ACT
    await driver.screen.scroll("down", 8)

    // ASSERT
    const believed = await driver.screen.believes()
    expect(believed.scroll).toBeGreaterThan(0)
    expect(await driver.screen.paintedTop()).toBe(believed.scroll)
  })

  test("then what the review believes still matches what it draws after a key follows the wheel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 110, height: 20, review: true })
    await driver.screen.scroll("down", 8)
    const before = await driver.screen.paintedTop()

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const after = await driver.screen.paintedTop()
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1)
  })
})
