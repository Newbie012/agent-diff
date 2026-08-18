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

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

describe("comments that have already gone to the agent", () => {
  it("stays in the diff after it is sent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("already said this")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const lines = frame.split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    expect(lines[anchor + 1]).toContain("✓ sent")
    expect(lines.findIndex((line) => line.includes("already said this"))).toBe(anchor + 2)
  })

  it("comes back when the review is reopened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("said this last time")
    await driver.screen.pressCtrl("s")
    await driver.agent.listComments(branch.worktree)
    await driver.screen.pressEscape()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "said this last time")).not.toHaveLength(0)
  })
})

describe("walking past comments already sent", () => {
  it("stops on a sent comment too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j", "j"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("gone already")
    await driver.screen.pressCtrl("s")
    await driver.screen.pressKeys(["g"])

    // ACT
    await driver.screen.pressKeys(["n"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "const second = 2")).toContain("▎")
  })
})
