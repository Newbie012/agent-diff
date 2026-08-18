import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const rowWith = (frame: string, text: string): string =>
  rowsOf(frame).find((row) => row.includes(text)) ?? ""

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const rowAt = (frame: string, text: string): number =>
  rowsOf(frame).findIndex((row) => row.includes(text))

const LONG =
  "a line long enough that it has to wrap inside the panel instead of running off the edge"

describe("the box you write a comment in", () => {
  it("is drawn as a panel with a bar down its edge, not a box", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const panel = rowsOf(frame).filter((row) => row.includes("┃")).join("")
    expect(frame).toContain("Comment on src/api.ts")
    expect(panel).not.toContain("╭")
    expect(panel).not.toContain("╰")
    expect(rowWith(frame, "Comment on src/api.ts")).toContain("┃")
  })

  it("ends just below what you have written", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.typeText("one short remark")

    // ASSERT
    const rows = rowsOf(await driver.screen.getFrame())
    const written = rows.findIndex((row) => row.includes("one short remark"))
    const actions = rows.findIndex((row) => row.includes("cancel"))
    expect(written).toBeGreaterThan(0)
    expect(actions - written).toBe(2)
  })

  it("offers its actions on the box, with their keys", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const actions = rowsOf(frame).find((row) => row.includes("cancel")) ?? ""
    expect(actions).toContain("esc")
    expect(actions).toContain("cancel")
    expect(actions).toContain("send it")
    expect(actions).not.toContain("add to review")
  })

  it("grows as the comment runs onto more lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("first line")

    // ACT
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.typeText("second line")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "Comment on src/api.ts")).toContain("Comment on src/api.ts")
    expect(rowAt(frame, "second line") - rowAt(frame, "first line")).toBe(1)
    expect(rowAt(frame, "cancel") - rowAt(frame, "second line")).toBe(2)
  })

  it("wraps a line too long for the panel, and grows to fit the wrap", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.typeText(LONG)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "Comment on src/api.ts")).toContain("Comment on src/api.ts")
    expect(rowAt(frame, "a line long enough")).toBeGreaterThan(0)
    expect(rowAt(frame, "off the edge")).toBeGreaterThan(rowAt(frame, "a line long enough"))
    expect(rowAt(frame, "cancel") - rowAt(frame, "off the edge")).toBe(2)
  })

  it("wraps to the panel at whatever width the terminal is", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 64, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])

    // ACT
    await driver.screen.typeText(LONG)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "Comment on src/api.ts")).toContain("Comment on src/api.ts")
    expect(rowAt(frame, "off the edge")).toBeGreaterThan(rowAt(frame, "a line long"))
    expect(rowAt(frame, "cancel") - rowAt(frame, "off the edge")).toBe(2)
  })
})
