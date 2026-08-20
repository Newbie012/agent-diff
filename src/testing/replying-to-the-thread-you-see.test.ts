import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/one.ts",
    before: ["const a = 1", "const b = 2"],
    after: ["const a = 1", "const b = 2", "const one = 3", "const two = 4"],
  },
]

describe("replying to a thread", () => {
  it("shows the conversation, not the code already on screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 34 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("why is this here")
    await driver.screen.pressCtrl("s")
    const [one] = await driver.agent.listComments(branch.worktree)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: one?.id ?? "",
      body: "because the caller needs it",
    })
    await driver.screen.pressKeys(["r"])
    await driver.screen.pressKeys(["shift+tab"])

    // ACT
    await driver.screen.pressKeys(["R"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why is this here")
    expect(frame).toContain("because the caller needs it")
  })
})
