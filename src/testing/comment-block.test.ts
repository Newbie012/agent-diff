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

const long =
  "Worth carrying the tenant here too, otherwise the log line is ambiguous and nobody reading it later can tell which tenant the failure belonged to."

const rowsWith = (frame: string, text: string): ReadonlyArray<string> =>
  frame.split("\n").filter((line) => line.includes(text))

const rowWith = (frame: string, text: string): string => rowsWith(frame, text)[0] ?? ""

describe("how a comment sits in the diff", () => {
  it("says a comment has gone to the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("short one")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const lines = frame.split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    expect(lines[anchor + 1]).toContain("sent")
    expect(lines[anchor + 2]).toContain("short one")
  })

  it("wraps a long comment inside the diff instead of running off it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText(long)
    await driver.screen.pressCtrl("s")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowsWith(frame, "Worth carrying the tenant")).toHaveLength(1)
    expect(frame).toContain("nobody reading it later")
    expect(rowWith(frame, "Worth carrying the tenant").length).toBeLessThanOrEqual(
      frame.split("\n")[0]?.length ?? 0,
    )
  })

  it("runs a rule down the left of every line it takes up", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText(long)
    await driver.screen.pressCtrl("s")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "Worth carrying the tenant")).toContain("│")
    expect(rowWith(frame, "nobody reading it later")).toContain("│")
  })
})
