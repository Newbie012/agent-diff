import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lines = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `${mark} ${at + 1}`)

const wide = [
  {
    path: "src/wide.ts",
    before: ["const head = 0", ...lines(100, "kept"), "const tail = 0"],
    after: ["const head = 1", ...lines(100, "kept"), "const tail = 1"],
  },
]

const small = [
  {
    path: "src/small.ts",
    before: ["alpha", "bravo", "charlie"],
    after: ["alpha", "bravo CHANGED", "charlie"],
  },
]

const readout = (frame: string): string =>
  frame.split("\n").find((line) => line.includes(" lines")) ?? ""

describe("when the reviewer copies", () => {
  test("then the gap marker stays out of the clipboard", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: wide })
    await driver.screen.open({ width: 120, height: 26 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["j", "j", "j", "j"])
    await driver.screen.pressKeys(["v", "j", "j", "j", "j"])
    const said = readout(await driver.screen.getFrame())
    await driver.screen.pressKeys(["y"])

    // ASSERT
    const taken = await driver.screen.copied()
    expect(said).not.toBe("")
    expect(taken).not.toContain("lines hidden")
    expect(taken).not.toContain("opens")
  })

  test("then the count matches the lines copied", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: small })
    await driver.screen.open({ width: 120, height: 26 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["v", "j", "j", "j"])
    const said = readout(await driver.screen.getFrame())
    await driver.screen.pressKeys(["y"])

    // ASSERT
    const taken = (await driver.screen.copied()).split("\n").filter((one) => one.length > 0)
    expect(said).toContain("lines selected")
    expect(await driver.screen.getFrame()).toContain(`${taken.length} lines copied`)
  })

  test("then the selection is copied rather than the comment under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: small })
    await driver.screen.open({ width: 120, height: 26 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("a note about bravo")
    await driver.screen.pressCtrl("s")

    // ACT
    await driver.screen.pressKeys(["v", "j", "j", "j"])
    await driver.screen.pressKeys(["y"])

    // ASSERT
    const taken = await driver.screen.copied()
    expect(taken).not.toContain("a note about bravo")
    expect(taken).toContain("alpha")
  })
})
