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

describe("what the footer is for", () => {
  it("keeps rare actions out of the way", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = footerOf(await driver.screen.getFrame())
    expect(footer).not.toContain("bug")
    expect(footer).not.toContain("hunk")
    expect(footer).not.toContain("pane")
  })

  it("always offers the way to everything else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).toContain("commands")
  })

  it("offers to send the review only once something is staged", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    expect(footerOf(await driver.screen.getFrame())).not.toContain("S send")

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("hold this")
    await driver.screen.pressCtrl("a")

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).toContain("S send 1")
  })
})
