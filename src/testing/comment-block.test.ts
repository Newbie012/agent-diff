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

const long =
  "Worth carrying the tenant here too, otherwise the log line is ambiguous and nobody reading it later can tell which tenant the failure belonged to."

const rowsWith = (frame: string, text: string): ReadonlyArray<string> =>
  frame.split("\n").filter((line) => line.includes(text))

const rowWith = (frame: string, text: string): string => rowsWith(frame, text)[0] ?? ""

describe("when a comment sits in the diff", () => {
  test("then the comment is marked as gone to the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("short one")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const lines = frame.split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    expect(lines[anchor + 1]).toContain("sent")
    expect(lines[anchor + 2]).toContain("short one")
  })

  test("then a long comment wraps inside the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment(long)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowsWith(frame, "Worth carrying the tenant")).toHaveLength(1)
    expect(frame).toContain("nobody reading it later")
    expect(rowWith(frame, "Worth carrying the tenant").length).toBeLessThanOrEqual(
      frame.split("\n")[0]?.length ?? 0,
    )
  })

  test("then a rule runs down the left of every line the comment takes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment(long)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "Worth carrying the tenant")).toContain("│")
    expect(rowWith(frame, "nobody reading it later")).toContain("│")
  })
})
