import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { overReview } from "../tui/index.ts"

const files = [{ path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] }]

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 120, height: 24 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("pressing ctrl+c", () => {
  it("closes the box being written in rather than the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("a point")

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("send it")
    expect(frame).toContain("const one = 2")
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  it("closes the key sheet rather than the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["?"])

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("const one = 2")
  })

  it("asks before leaving when nothing is open over the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("press ctrl+c again to leave")
    expect(frame).toContain("const one = 2")
  })

  it("forgets the asking when another key is pressed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressCtrl("c")

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("press ctrl+c again")
  })

  it("still leaves when nothing is open over the review", () => {
    // ARRANGE
    const screens = ["review", "branches"] as const

    // ACT
    const leaves = screens.map((screen) => !overReview(screen))

    // ASSERT
    expect(leaves).toEqual([true, true])
  })

  it("does not leave while something is open over it", () => {
    // ARRANGE
    const screens = ["compose", "report", "keys", "palette", "search"] as const

    // ACT
    const leaves = screens.map((screen) => !overReview(screen))

    // ASSERT
    expect(leaves).toEqual([false, false, false, false, false])
  })
})
