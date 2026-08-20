import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const long = Array.from({ length: 90 }, (_, at) => `const line${at} = ${at};`)

const bigFile = {
  files: [
    {
      path: "src/big.ts",
      before: long,
      after: long.map((line, at) => (at % 3 === 0 ? `${line} // touched` : line)),
    },
  ],
}

const topRow = (frame: string): string => {
  const lines = frame.split("\n")
  const top = lines.findIndex((line) => line.includes("╭"))
  const bottom = lines.findIndex((line) => line.includes("╰"))
  return (
    lines
      .slice(top + 1, bottom === -1 ? undefined : bottom)
      .map((line) => line.slice(33))
      .find((line) => /\bline\d+/.test(line)) ?? ""
  )
}

describe("scrolling after a drag", () => {
  it("scrolls the diff when nothing has been selected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(bigFile)
    await driver.screen.open({ width: 120, height: 24, review: true })
    const before = topRow(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("down", 3)

    // ASSERT
    expect(topRow(await driver.screen.getFrame())).not.toBe(before)
  })

  it("still scrolls once a selection is under way", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(bigFile)
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.dragOverLines("const line0 = 0;", "const line4 = 4;")
    const before = topRow(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("down", 3)

    // ASSERT
    expect(topRow(await driver.screen.getFrame())).not.toBe(before)
  })
})
