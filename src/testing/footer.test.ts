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
    const footer = await driver.screen.footer()
    expect(footer).toContain("^s")
    expect(footer).not.toContain("ctrl+s")
  })

  it("says what is selected while a selection is being made", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["v", "j"])

    // ASSERT
    expect(await driver.screen.footer()).toContain("2 lines")
  })

  it("clears a message on its own, so the footer does not accumulate history", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["m"])
    expect(await driver.screen.footer()).toContain("marked")

    // ACT
    await driver.screen.waitForNoticeToClear("marked")

    // ASSERT
    expect(await driver.screen.footer()).not.toContain("marked")
  })
})
