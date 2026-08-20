import { describe, expect, test } from "@effect/vitest"
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

const openSheet = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(oneFile)
  await driver.screen.open({ review: true })
  await driver.screen.pressKeys(["?"])
}

describe("when a key is searched for in the sheet", () => {
  test("then only what the typing matches is kept", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openSheet(driver)
    expect(await driver.screen.getFrame()).toContain("Report a bug")

    // ACT
    await driver.screen.typeText("settle")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Settle every answer already read")
    expect(frame).not.toContain("Report a bug")
  })

  test("then the sheet reports nothing matches and takes the typing back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openSheet(driver)
    await driver.screen.typeText("zzz")
    expect(await driver.screen.getFrame()).toContain("No key matches")

    // ACT
    await driver.screen.pressBackspaceWith({})
    await driver.screen.pressBackspaceWith({})
    await driver.screen.pressBackspaceWith({})

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Report a bug")
  })
})
