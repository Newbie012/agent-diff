import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = [
  "export class Mapper {",
  ...Array.from({ length: 60 }, (_, at) => `    const step${at} = ${at};`),
  "}",
]

const SCOPE = "export class Mapper"

const firstDiffRow = (frame: string): string =>
  frame
    .split("\n")
    .slice(2)
    .map((line) => line.slice(34, 90))
    .find((line) => line.trim().length > 2) ?? ""

const numbered = (row: string): boolean => /\d/.test(row.slice(0, 12))

const pinned = (frame: string): boolean => {
  const row = firstDiffRow(frame)
  return row.includes(SCOPE) && !numbered(row)
}

describe("when the pinned scope is toggled", () => {
  test("then S hides the pin, S brings it back, and the choice is remembered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/mapper.ts", before: [], after: body }] })
    await driver.screen.open({ width: 120, height: 20, review: true })
    await driver.screen.pressKeys(["G"])
    const withPin = await driver.screen.getFrame()
    expect(pinned(withPin), withPin).toBe(true)

    // ACT
    await driver.screen.pressKeys(["S"])

    // ASSERT
    const without = await driver.screen.getFrame()
    expect(pinned(without), without).toBe(false)
    await driver.screen.restart({ width: 120, height: 20 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["G"])
    const again = await driver.screen.getFrame()
    expect(pinned(again), again).toBe(false)
  })
})
