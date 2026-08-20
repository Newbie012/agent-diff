import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const lit = async (driver: TestDriver): Promise<string> =>
  (await driver.screen.paintedWith(palette.selection)).join(" ")

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const withComment = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 150, height: 30 })
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText("worth a second look")
  await driver.screen.pressKeys(["ctrl+s"])
}

describe("where the keys go when the review panel opens", () => {
  it("puts them on the comments, so they can be read straight away", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withComment(driver)
    await driver.screen.pressKeys(["a"])

    // ACT
    await driver.screen.pressKeys(["a"])

    // ASSERT
    expect(await lit(driver)).toContain("worth a second look")
  })

  it("gives them back to the pane you came from when it closes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withComment(driver)
    await driver.screen.pressKeys(["shift+tab"])
    const onTree = await lit(driver)
    expect(onTree).toContain("one.ts")
    await driver.screen.pressKeys(["a"])
    await driver.screen.pressKeys(["a"])
    expect(await lit(driver)).not.toBe(onTree)

    // ACT
    await driver.screen.pressKeys(["a"])

    // ASSERT
    expect(await lit(driver)).toBe(onTree)
  })

  it("leaves the keys where they were when there is nothing to read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["a"])

    // ACT
    await driver.screen.pressKeys(["a"])

    // ASSERT
    expect(await lit(driver)).not.toContain("one.ts")
  })
})
