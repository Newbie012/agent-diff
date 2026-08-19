import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

const opened = async (driver: TestDriver): Promise<TestDriver> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 140, height: 26 })
  await driver.screen.pressKeys(["RETURN"])
  return driver
}

describe("which pane the keys will reach", () => {
  it("lights the file list brighter when it is the focused one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    const resting = await driver.screen.paintedWith(palette.resting)

    // ACT
    await driver.screen.pressKeys(["shift+tab"])

    // ASSERT
    const lit = await driver.screen.paintedWith(palette.selection)
    expect(resting.join(" ")).toContain("one.ts")
    expect(lit.join(" ")).toContain("one.ts")
  })

  it("says which file is current whether or not the list is focused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    const resting = await driver.screen.paintedWith(palette.resting)

    // ASSERT
    expect(resting.join(" ")).toContain("one.ts")
  })
})
