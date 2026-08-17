import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
}

const HEBREW_LETTER_ON_THE_N_KEY = `[1503::110u`

describe("a keyboard that is not English", () => {
  it("answers to the key the letter sits on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys([HEBREW_LETTER_ON_THE_N_KEY])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no comments yet")
  })
})
