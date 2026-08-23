import { describe, expect, test } from "@effect/vitest"
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

describe("when the keyboard is not English", () => {
  test("then adiff answers to the key the letter sits on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys([HEBREW_LETTER_ON_THE_N_KEY])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing waiting on you here")
  })
})
