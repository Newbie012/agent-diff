import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 80 }, (_, at) => `  private step${at}() { return ${at}; }`)

const diffRows = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .map((line) => line.slice(33, 90))
    .filter((line) => /step\d+/.test(line))

describe("typing a comment", () => {
  it("leaves the diff behind it where it was", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/mapper.ts", before: [], after: body }] })
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.scroll("down", 20)
    await driver.screen.pressKeys(["c"])
    const before = diffRows(await driver.screen.getFrame())

    // ACT
    await driver.screen.typeText("a first line of a comment that is long enough to wrap")
    await driver.screen.typeText(" and a second line to push the box taller still")

    // ASSERT
    const after = diffRows(await driver.screen.getFrame())
    expect(before[0]).toBeDefined()
    expect(after[0]).toBe(before[0])
  })
})
