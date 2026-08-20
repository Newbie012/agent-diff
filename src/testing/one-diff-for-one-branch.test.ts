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
    await driver.screen.open({ width: 120, height: 24, review: true })
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(0)
  })

  it("asks git for nothing when a thread is settled or removed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [...(many?.files ?? [])] })
    await driver.app.runComment({
      branch: branch.name,
      file: many?.files[0]?.path ?? "",
      start: 1,
      end: 1,
      body: "why",
    })
    await driver.screen.open({ width: 120, height: 24, branch: branch.name })
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressKeys(["n", "d"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(0)
  })

  it("reads one file, not the branch, when a comment is sent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(many?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("why is this here")
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(1)
  })

  it("reads it once more when the branch is opened again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(many?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressEscape()
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(1)
  })
})
