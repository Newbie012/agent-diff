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

describe("when a selection is under way", () => {
  test("then the footer says which key copies", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 140, height: 20, review: true })
    expect(await driver.screen.getFrame()).not.toContain("y copy")

    // ACT
    await driver.screen.pressKeys(["v", "j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("y copy")
  })
})
