import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [{ path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] }]

describe("when ctrl+c is pressed", () => {
  test("then the compose box closes and the review stays", async () => {
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

  test("then the key sheet closes and the review stays", async () => {
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

  test("then adiff asks before leaving", async () => {
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

  test("then another key forgets the asking", async () => {
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

  test("then the palette closes and the review stays", async () => {
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

  test("then the search closes and the review stays", async () => {
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

  test("then the bug report closes and the review stays", async () => {
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

  test("then adiff asks before leaving the branch list", async () => {
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
