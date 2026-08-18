import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = [
  "export class Mapper {",
  ...Array.from({ length: 60 }, (_, at) => `    const step${at} = ${at};`),
  "}",
]

const firstDiffRow = (frame: string): string =>
  frame.split("\n").slice(2).map((line) => line.slice(34, 74)).find((line) => line.trim().length > 2) ?? ""

const pinned = (frame: string): boolean => !/\d+\s[+-]/.test(firstDiffRow(frame))

describe("the scope pinned above the diff", () => {
  it("goes away on S, comes back on S, and is remembered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/mapper.ts", before: [], after: body }] })
    await driver.screen.open({ width: 120, height: 20 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["G"])
    expect(pinned(await driver.screen.getFrame())).toBe(true)

    // ACT
    await driver.screen.pressKeys(["S"])

    // ASSERT
    expect(pinned(await driver.screen.getFrame())).toBe(false)
    await driver.screen.restart({ width: 120, height: 20 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["G"])
    expect(pinned(await driver.screen.getFrame())).toBe(false)
  })
})
