import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"

const many = shapes.find((shape) => shape.files.length > 4) ?? shapes[0]

describe("what opening a branch asks git for", () => {
  it("reads its diff once, however much the review wants to know", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(many?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24 })
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(1)
  })

  it("asks git for nothing at all when a file is marked reviewed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(many?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(0)
  })

  it("reads it once more when the branch is opened again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(many?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressEscape()
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(1)
  })
})
