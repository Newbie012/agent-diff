import { describe, expect, test } from "@effect/vitest"
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

describe("when text is pasted into a draft", () => {
  test("then the whole paste lands at the caret", async () => {
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

  test("then the caret sits after what was pasted", async () => {
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

  test("then a pasted block keeps its line breaks", async () => {
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

  test("then what a terminal can smuggle in is stripped", async () => {
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

  test("then a pasted tab has a width", async () => {
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

  test("then the palette query stays on one line", async () => {
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
