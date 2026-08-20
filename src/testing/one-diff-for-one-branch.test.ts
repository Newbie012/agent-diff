import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"

const many = shapes.find((shape) => shape.files.length > 4) ?? shapes[0]

describe("when a branch is opened", () => {
  test("then the diff is read once, however much the review asks", async () => {
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

  test("then marking a file reviewed asks git for nothing", async () => {
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

  test("then settling or removing a thread asks git for nothing", async () => {
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

  test("then sending a comment reads one file", async () => {
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

  test("then opening the branch again reads the diff once more", async () => {
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
