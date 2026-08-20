import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
}

const highlighted = (frame: string): string =>
  frame.split("\n").find((row) => row.includes("┃") && row.includes("▎")) ?? ""

describe("the sheet of every key", () => {
  it("scrolls with the wheel, not the diff behind it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ height: 40, review: true })
    await driver.screen.pressKeys(["?"])

    const before = highlighted(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("down", 20)

    // ASSERT
    const after = highlighted(await driver.screen.getFrame())
    expect(before).not.toBe("")
    expect(after).not.toBe(before)
  })
})
