import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const long = Array.from({ length: 40 }, (_, at) => `line ${at} of a long comment about this`).join(
  " ",
)

describe("the box a comment is written in", () => {
  it("stays inside a short terminal however much is typed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 80, height: 24, review: true })
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.typeText(long)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame.split("\n").filter((line) => line.length > 0)).toHaveLength(24)
    expect(frame).toContain("send it")
  })
})
