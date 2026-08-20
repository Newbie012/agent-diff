import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const long =
  "  const message = `a team invitation for ${email} could not be sent because the seat count for ${team} is already spent`"

const wide = {
  files: [
    {
      path: "src/api.ts",
      before: ["const kept = 1", "}"],
      after: ["const kept = 1", long, "}"],
    },
  ],
}

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const codeRow = (frame: string): string =>
  rowsOf(frame).find((row) => row.includes("const message")) ?? ""

const numbered = (frame: string): ReadonlyArray<string> =>
  rowsOf(frame).filter((row) => /│\s*[▎●\s]*\d+\s/.test(row))

describe("when the reviewer reads past the right edge", () => {
  test("then the code pans sideways", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })
    expect(codeRow(await driver.screen.getFrame())).toContain("const message")

    // ACT
    await driver.screen.pressKeys([">", ">", ">", ">", ">"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowsOf(frame).some((row) => row.includes("could not be sent"))).toBe(true)
  })

  test("then the code comes back to the left", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })
    await driver.screen.pressKeys([">", ">", ">", ">", ">"])

    // ACT
    await driver.screen.pressKeys(["<", "<", "<", "<", "<", "<"])

    // ASSERT
    expect(codeRow(await driver.screen.getFrame())).toContain("const message")
  })

  test("then the line numbers stay where they are", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })
    const before = numbered(await driver.screen.getFrame()).length

    // ACT
    await driver.screen.pressKeys([">", ">", ">", ">"])

    // ASSERT
    const after = numbered(await driver.screen.getFrame())
    expect(after).toHaveLength(before)
    expect(after.some((row) => /\s2\s/.test(row))).toBe(true)
  })

  test("then the footer reports nothing to pan while wrapping is on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })
    await driver.screen.pressKeys(["w"])

    // ACT
    await driver.screen.pressKeys([">", ">", ">"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("wrapping is on")
    expect(codeRow(frame)).toContain("const message")
  })
})

describe("when the diff is panned", () => {
  test("then the footer reads how far right the view has moved", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })
    expect(await driver.screen.getFrame()).not.toMatch(/→ \d+ columns(?! cut off)/)

    // ACT
    await driver.screen.pressKeys([">", ">"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("16 columns")
  })
})

describe("when the wheel pans", () => {
  test("then holding shift moves the code sideways", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })

    // ACT
    await driver.screen.panWith("down", 3)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("columns")
  })

  test("then a plain wheel leaves the code where it was", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })

    // ACT
    await driver.screen.scroll("down", 3)

    // ASSERT
    expect(await driver.screen.getFrame()).not.toMatch(/→ \d+ columns(?! cut off)/)
  })
})
