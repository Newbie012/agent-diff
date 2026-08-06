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

const footerOf = (frame: string): string => {
  const lines = frame.split("\n").filter((line) => line.trim().length > 0)
  return lines.at(-1) ?? ""
}

describe("reading the keys off the bottom of the screen", () => {
  it("writes modifiers and named keys as glyphs, not as words", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["v", "c"])

    // ASSERT
    const footer = footerOf(await driver.screen.getFrame())
    expect(footer).toContain("^s")
    expect(footer).not.toContain("ctrl+s")
  })

  it("says what is selected while a selection is being made", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["v", "j"])

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).toContain("2 lines")
  })

  it("clears a message on its own, so the footer does not accumulate history", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["m"])
    expect(footerOf(await driver.screen.getFrame())).toContain("marked")

    // ACT
    await driver.screen.waitForNoticeToClear("marked")

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).not.toContain("marked")
  })
})
