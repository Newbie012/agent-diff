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

const gutter = (frame: string): string =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => line.slice(37, 39))
    .join("")

describe("seeing where the comments are", () => {
  it("marks the line a staged comment is attached to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN", "j", "c"])
    await driver.screen.typeText("about the first")

    // ACT
    await driver.screen.pressCtrl("a")

    // ASSERT
    expect(gutter(await driver.screen.getFrame())).toContain("○")
  })

  it("shows no mark before anything is commented on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(gutter(await driver.screen.getFrame())).not.toContain("○")
  })
})
