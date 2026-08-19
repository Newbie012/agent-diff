import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const numbered = {
  files: [
    {
      path: "src/layers.ts",
      before: ["const zero = 0"],
      after: ["const zero = 0", "const one = 1", "const two = 2", "const three = 3"],
    },
  ],
}

describe("knowing which line you are on", () => {
  it("highlights the line the cursor is on, and only that line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(numbered)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["j", "j"])

    // ASSERT
    const highlighted = await driver.screen.findUnderCursor()
    expect(highlighted).toHaveLength(1)
    expect(highlighted[0]).toContain("const two = 2")
  })

  it("highlights every line of a selection", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(numbered)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["j", "v", "j", "j"])

    // ASSERT
    const selected = await driver.screen.findPicked()
    expect(selected.map((line) => line.trim())).toEqual(
      expect.arrayContaining([expect.stringContaining("const one = 1")]),
    )
    expect(selected).toHaveLength(2)
  })
})
