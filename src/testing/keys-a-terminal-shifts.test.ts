import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const ESC = ""

const kitty = (key: number, shifted: number): string => `${ESC}[${key}:${shifted};2u`

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 130, height: 26 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("the keys a terminal reports as shifted", () => {
  it("opens the key sheet on question mark, not the search", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressKeys([kitty(47, 63)])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Keys here")
    expect(frame).not.toContain("elsewhere")
  })

  it("widens the context on plus, which is shift and equals", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    const before = await driver.screen.getFrame()

    // ACT
    await driver.screen.pressKeys([kitty(61, 43)])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toBe(before)
  })
})
