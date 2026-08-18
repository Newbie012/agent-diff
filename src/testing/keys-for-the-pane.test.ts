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

const footerOf = (frame: string): string => {
  const lines = frame.split("\n").filter((line) => line.trim().length > 0)
  return lines.at(-1) ?? ""
}

describe("the keys the footer carries", () => {
  it("names what the focused pane answers to, and nothing else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 24 })
    await driver.screen.pressKeys(["RETURN", "m"])
    const onTheDiff = footerOf(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressShiftTab()
    const onTheTree = footerOf(await driver.screen.getFrame())
    await driver.screen.pressTab()
    await driver.screen.pressTab()
    const onTheReview = footerOf(await driver.screen.getFrame())

    // ASSERT
    expect(onTheDiff).toContain("v select")
    expect(onTheDiff).not.toContain("s layers")
    expect(onTheTree).toContain("f hide read")
    expect(onTheTree).not.toContain("v select")
    expect(onTheReview).toContain("D settle read")
    expect(onTheReview).not.toContain("] file")
  })
})
