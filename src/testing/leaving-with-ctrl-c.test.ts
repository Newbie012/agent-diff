import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [{ path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] }]

describe("pressing ctrl+c", () => {
  it("closes the box being written in rather than the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24, review: true })
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
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressKeys(["?"])

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("const one = 2")
  })

  it("asks before leaving when nothing is open over the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24, review: true })

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
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressCtrl("c")

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("press ctrl+c again")
  })

  it("closes the command palette rather than the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressCtrl("p")

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Commands")
    expect(frame).toContain("const one = 2")
  })

  it("closes the search rather than the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Look for something")
    expect(frame).toContain("const one = 2")
  })

  it("closes the bug report rather than the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressCtrl("b")

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("const one = 2")
    expect(await driver.agent.listReports()).toHaveLength(0)
  })

  it("asks before leaving the branch list too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24 })

    // ACT
    await driver.screen.pressCtrl("c")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("press ctrl+c again to leave")
  })
})
