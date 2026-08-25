import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const file = (mark: string) => ({
  path: `src/${mark}.ts`,
  before: ["const a = 1"],
  after: ["const a = 1", `const ${mark} = 2`],
})

const stacked = async (driver: TestDriver) => {
  const under = await driver.branch.create({ name: "under-the-stack", files: [file("one")] })
  await driver.branch.commitAll(under, "under")
  const over = await driver.branch.stackOn(under, {
    name: "over-the-stack",
    files: [file("two")],
  })
  return { under, over }
}

describe("when a reviewer sets the base from the terminal", () => {
  test("then the refs this repository has are offered, newest first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await stacked(driver)
    await driver.screen.open({ width: 170, height: 30 })

    // ACT
    await driver.screen.pressKeys(["b"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Base for")
    expect(frame).toContain("under-the-stack")
  })

  test("then typing narrows the refs offered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await stacked(driver)
    await driver.screen.open({ width: 170, height: 30 })
    await driver.screen.pressKeys(["b"])

    // ACT
    await driver.screen.typeText("under")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("under-the-stack")
    expect(frame).not.toContain("over-the-stack\n")
  })

  test("then the diff is read again against the base that was chosen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await stacked(driver)
    await driver.screen.open({ width: 170, height: 30, branch: "over-the-stack" })
    expect(await driver.screen.getFrame()).toContain("file 1 of 1")

    // ACT
    await driver.screen.pressKeys(["b"])
    await driver.screen.typeText("master")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.untilShown("file 1 of 2")).toBe(true)
  })

  test("then the base goes back to adiff's own guess", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await stacked(driver)
    await driver.screen.open({ width: 170, height: 30, branch: "over-the-stack" })
    await driver.screen.pressKeys(["b"])
    await driver.screen.typeText("master")
    await driver.screen.pressKeys(["RETURN"])
    expect(await driver.screen.untilShown("file 1 of 2")).toBe(true)

    // ACT
    await driver.screen.pressKeys(["b"])
    await driver.screen.pressCtrl("x")

    // ASSERT
    expect(await driver.screen.untilShown("file 1 of 1")).toBe(true)
  })

  test("then a base that names nothing is refused and the branch is left alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await stacked(driver)
    await driver.screen.open({ width: 170, height: 30 })

    // ACT
    await driver.screen.pressKeys(["b"])
    await driver.screen.typeText("no-such-ref")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.untilShown("no-such-ref names nothing here")).toBe(true)
  })
})
