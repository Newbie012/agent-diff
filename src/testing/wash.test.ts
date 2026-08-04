import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const mixed = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0", "const gone = 1", "const tail = 9"],
      after: ["const keep = 0", "const added = 2", "const tail = 9"],
    },
  ],
}

describe("seeing what changed", () => {
  it("keeps the added and removed washes after the cursor has moved", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(mixed)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["j", "j", "j"])

    // ASSERT
    const added = await driver.screen.findHighlighted(palette.addedBg)
    const removed = await driver.screen.findHighlighted(palette.removedBg)
    expect(added.join(" ")).toContain("const added = 2")
    expect(removed.join(" ")).toContain("const gone = 1")
  })
})
