import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/one.ts",
    before: ["const kept = 0", "const one = 1", "const tail = 9"],
    after: ["const kept = 0", "const one = 1001", "const tail = 9"],
  },
]

const gone = [
  {
    path: "src/two.ts",
    before: ["const kept = 0", "const two = 2", "const tail = 9"],
    after: ["const kept = 0", "const tail = 9"],
  },
]

describe("when a selection crossing a change is copied", () => {
  test("then the version being kept is copied", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["v", "j", "j", "j"])
    await driver.screen.pressKeys(["y"])

    // ASSERT
    const taken = await driver.screen.copied()
    expect(taken).toContain("const one = 1001")
    expect(taken).not.toContain("const one = 1\n")
  })

  test("then deleted lines are copied when only they were picked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: gone })
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["j", "v"])
    await driver.screen.pressKeys(["y"])

    // ASSERT
    expect(await driver.screen.copied()).toContain("const two = 2")
  })
})
