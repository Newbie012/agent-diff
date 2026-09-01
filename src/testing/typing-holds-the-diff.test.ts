import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 80 }, (_, at) => `  private step${at}() { return ${at}; }`)

const rowOf = (frame: string, text: string): number =>
  frame.split("\n").findIndex((line) => line.includes(text))

describe("when a comment is being typed", () => {
  test("then the line the draft hangs under stays on screen above it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/mapper.ts", before: [], after: body }] })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.scroll("down", 20)
    await driver.screen.pressKeys(["j", "c"])

    // ACT
    await driver.screen.typeText("a first line of a comment that is long enough to wrap")
    await driver.screen.typeText(" and a second line to push the box taller still")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const title = /Comment on src\/mapper\.ts:(\d+)/.exec(frame)
    const anchored = Number(title?.[1] ?? 0)
    expect(anchored).toBeGreaterThan(0)
    const line = rowOf(frame, `private step${anchored - 1}()`)
    expect(line).toBeGreaterThan(0)
    expect(rowOf(frame, "a first line of a comment")).toBeGreaterThan(line)
  })
})
