import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lines = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `line ${at + 1}`)

const files = [
  {
    path: "src/a.ts",
    before: [...lines(29), "line 30"],
    after: [...lines(29), "CHANGED 30"],
  },
]

const hiddenIn = (frame: string): string =>
  frame.split("\n").find((line) => line.includes("lines hidden")) ?? ""

describe("a comment left inside a gap", () => {
  it("can still be reached from the review after the gap closes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 26 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["k"])
    const before = hiddenIn(await driver.screen.getFrame())
    await driver.screen.pressKeys(["l"])
    expect(hiddenIn(await driver.screen.getFrame())).not.toBe(before)
    await driver.screen.pressKeys(["j", "j", "j", "j"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("a point inside the gap")
    await driver.screen.pressCtrl("s")

    // ACT
    await driver.screen.pressKeys(["k", "k", "k", "k"])
    await driver.screen.pressKeys(["h"])
    await driver.screen.pressKeys(["tab"])
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("outside this diff")
    expect(frame).toContain("line 20")
  })
})
