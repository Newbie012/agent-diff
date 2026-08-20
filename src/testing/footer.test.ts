import { describe, expect, test } from "@effect/vitest"
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

describe("when the footer is read", () => {
  test("then modifiers and named keys are written as glyphs", async () => {
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

  test("then the footer counts what is selected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["v", "j"])

    // ASSERT
    expect(await driver.screen.footer()).toContain("2 lines")
  })

  test("then a message clears on its own", async () => {
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
