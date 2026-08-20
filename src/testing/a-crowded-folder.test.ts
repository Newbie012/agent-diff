import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const many = {
  files: Array.from({ length: 20 }, (_, at) => ({
    path: `src/parts/module${String(at).padStart(2, "0")}.ts`,
    before: ["const a = 1"],
    after: ["const a = 1", `const b${at} = 2`],
  })),
}

const header = (frame: string): string => frame.split("\n")[0] ?? ""

describe("when a folder holds more files than the tree draws at once", () => {
  test("then walking reaches every file, opening the folder on the way", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(many)
    await driver.screen.open({ width: 120, height: 20, review: true })
    expect(header(await driver.screen.getFrame())).toContain("module00.ts")

    // ACT
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["]"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(header(frame)).toContain("module02.ts")
    expect(frame).toContain("module02.ts")
  })

  test("then walking back reaches the same files in reverse", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(many)
    await driver.screen.open({ width: 120, height: 20, review: true })
    await driver.screen.pressKeys(["]", "]", "]"])

    // ACT
    await driver.screen.pressKeys(["["])

    // ASSERT
    expect(header(await driver.screen.getFrame())).toContain("module02.ts")
  })
})
