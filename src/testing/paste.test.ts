import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

describe("pasting into a draft", () => {
  it("lands the whole paste at the caret", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("see: ")

    // ACT
    await driver.screen.paste("the log said EACCES")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("see: the log said EACCES")
  })

  it("puts the caret after what was pasted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.paste("middle")
    await driver.screen.typeText("!")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("middle!")
  })

  it("keeps the line breaks in a pasted block", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.paste("first line\r\nsecond line")

    // ASSERT
    const lines = (await driver.screen.getFrame()).split("\n")
    expect(lines.some((line) => line.includes("first line") && line.includes("second line"))).toBe(
      false,
    )
    expect(lines.some((line) => line.includes("second line"))).toBe(true)
  })

  it("strips what a terminal can smuggle in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.paste("\u001b[31mred\u001b[0m\u0007 alert")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("red alert")
    expect(frame).not.toContain("31m")
  })

  it("gives a pasted tab a width", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.paste("if (x) {\n\treturn 1\n}")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("  return 1")
  })

  it("keeps the palette query on one line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressCtrl("p")

    // ACT
    await driver.screen.paste("wrap\nlines")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("wrap lines")
  })
})
