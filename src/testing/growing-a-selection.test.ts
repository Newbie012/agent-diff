import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const file = {
  files: [
    {
      path: "src/api.ts",
      before: [],
      after: ["const one = 1", "const two = 2", "const three = 3", "const four = 4"],
    },
  ],
}

describe("when shift is held with the arrows", () => {
  test("then the lines passed are taken into the selection", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 120, height: 20, review: true })
    const before = await driver.screen.getFrame()

    // ACT
    await driver.screen.pressShiftArrow("down")
    await driver.screen.pressShiftArrow("down")

    // ASSERT
    expect(before).not.toContain("3 lines")
    expect(await driver.screen.getFrame()).toContain("3 lines")
  })

  test("then letting go of shift opens the comment box", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 120, height: 20, review: true })
    await driver.screen.pressShiftArrow("down")

    // ACT
    await driver.screen.releaseShift()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/api.ts")
  })

  test("then a selection made without shift is left alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 120, height: 20, review: true })
    await driver.screen.pressKeys(["v", "j"])

    // ACT
    await driver.screen.releaseShift()

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Comment on")
  })

  test("then c can comment on the selection", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 120, height: 20, review: true })
    await driver.screen.pressShiftArrow("down")

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/api.ts")
  })
})
