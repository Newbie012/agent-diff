import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const many = {
  files: Array.from({ length: 20 }, (_, at) => ({
    path: `src/parts/module${String(at).padStart(2, "0")}.ts`,
    before: ["const a = 1"],
    after: ["const a = 1", `const b${at} = 2`],
  })),
}

const header = (frame: string): string => frame.split("\n")[0] ?? ""

describe("a folder with more files than the tree draws at once", () => {
  it("still walks between them, opening the folder as it goes", async () => {
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

  it("comes back the way it went", async () => {
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
