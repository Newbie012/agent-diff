import { describe, expect, it } from "@effect/vitest"
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

describe("reading past the right edge", () => {
  it("pans the code sideways", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])
    expect(codeRow(await driver.screen.getFrame())).toContain("const message")

    // ACT
    await driver.screen.pressKeys([">", ">", ">", ">", ">"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowsOf(frame).some((row) => row.includes("could not be sent"))).toBe(true)
  })

  it("comes back to the left", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys([">", ">", ">", ">", ">"])

    // ACT
    await driver.screen.pressKeys(["<", "<", "<", "<", "<", "<"])

    // ASSERT
    expect(codeRow(await driver.screen.getFrame())).toContain("const message")
  })

  it("keeps the line numbers where they are", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])
    const before = numbered(await driver.screen.getFrame()).length

    // ACT
    await driver.screen.pressKeys([">", ">", ">", ">"])

    // ASSERT
    const after = numbered(await driver.screen.getFrame())
    expect(after).toHaveLength(before)
    expect(after.some((row) => /\s2\s/.test(row))).toBe(true)
  })

  it("says nothing to pan while the diff is wrapped", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["w"])

    // ACT
    await driver.screen.pressKeys([">", ">", ">"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("wrapping is on")
    expect(codeRow(frame)).toContain("const message")
  })
})

describe("knowing the diff is panned", () => {
  it("says how far right the reader has moved", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])
    expect(await driver.screen.getFrame()).not.toContain("columns")

    // ACT
    await driver.screen.pressKeys([">", ">"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("16 columns")
  })
})

describe("panning with the wheel", () => {
  it("moves sideways when shift is held", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.panWith("down", 3)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("columns")
  })

  it("leaves the diff where it was for a plain wheel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.scroll("down", 3)

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("columns")
  })
})
