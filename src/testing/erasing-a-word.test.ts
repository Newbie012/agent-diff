import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const composing = async (driver: TestDriver, text: string): Promise<void> => {
  await driver.branch.create(oneFile)
  await driver.screen.open()
  await driver.screen.pressKeys(["RETURN", "c"])
  await driver.screen.typeText(text)
}

describe("erasing what was typed", () => {
  it("takes a word back with option and backspace", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await composing(driver, "keep this word")

    // ACT
    await driver.screen.pressBackspaceWith({ option: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("keep this")
    expect(frame).not.toContain("keep this word")
  })

  it("takes the line back with command and backspace", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await composing(driver, "all of this goes")

    // ACT
    await driver.screen.pressBackspaceWith({ meta: true })

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("all of this")
  })

  it("still takes one character without a modifier", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await composing(driver, "abcd")

    // ACT
    await driver.screen.pressBackspaceWith({})

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("abc")
  })
})
