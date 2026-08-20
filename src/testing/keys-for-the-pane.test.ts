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

describe("the keys the footer carries", () => {
  it("names what the focused pane answers to, and nothing else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 24, review: true })
    await driver.screen.pressKeys(["m"])
    const onTheDiff = await driver.screen.footer()

    // ACT
    await driver.screen.pressShiftTab()
    const onTheTree = await driver.screen.footer()
    await driver.screen.pressTab()
    await driver.screen.pressTab()
    const onTheReview = await driver.screen.footer()

    // ASSERT
    expect(onTheDiff).toContain("v select")
    expect(onTheDiff).not.toContain("s layers")
    expect(onTheTree).toContain("f hide read")
    expect(onTheTree).not.toContain("v select")
    expect(onTheReview).toContain("D settle read")
    expect(onTheReview).not.toContain("] file")
  })
})
