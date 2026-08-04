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

describe("a thread whose code has moved", () => {
  it("says the comment describes an older commit", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("why is this here")
    await driver.screen.pressCtrl("s")
    await driver.branch.setFile(branch, "src/api.ts", [
      "const keep = 0",
      "const first = 1",
      "const second = 2",
    ])
    await driver.branch.commitAll(branch, "one more line")

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why is this here")
    expect(frame).toContain("moved on")
  })

  it("says nothing of the sort while the code stands still", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("why is this here")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why is this here")
    expect(frame).not.toContain("moved on")
  })
})
