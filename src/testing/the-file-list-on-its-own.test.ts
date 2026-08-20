import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const panes = (frame: string): number =>
  (frame.split("\n").find((line) => line.includes("╭")) ?? "").split("╭").length - 1

const withComment = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 150, height: 30 })
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText("worth a second look")
  await driver.screen.pressKeys(["ctrl+s"])
}

describe("hiding the file list on its own", () => {
  it("leaves the review panel where it was", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withComment(driver)
    expect(panes(await driver.screen.getFrame())).toBe(3)

    // ACT
    await driver.screen.pressKeys(["t"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(panes(frame)).toBe(2)
    expect(frame).toContain("worth a second look")
  })

  it("brings it back when pressed again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withComment(driver)
    const before = await driver.screen.getFrame()
    await driver.screen.pressKeys(["t"])
    expect(await driver.screen.getFrame()).not.toBe(before)

    // ACT
    await driver.screen.pressKeys(["t"])

    // ASSERT
    expect(await driver.screen.getFrame()).toBe(before)
  })

  it("gives the keys to the diff rather than leaving them on a list that has gone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withComment(driver)
    await driver.screen.pressKeys(["shift+tab"])

    // ACT
    await driver.screen.pressKeys(["t"])
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("const one = 2")
  })
})
