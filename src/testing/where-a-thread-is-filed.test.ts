import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const panelOf = (frame: string): string => frame

describe("where a thread is filed in the review", () => {
  it("puts a question the agent asked back where it cannot be missed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 34 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("is this right")
    await driver.screen.pressCtrl("s")
    const [one] = await driver.agent.listComments(branch.worktree)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: one?.id ?? "",
      body: "which way do you want it",
      asks: true,
    })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const panel = panelOf(await driver.screen.getFrame())
    expect(panel).toContain("Waiting on you")
    expect(panel).not.toContain("With the agent")
  })

  it("gives a settled thread a section of its own", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 34 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("a point to close")
    await driver.screen.pressCtrl("s")
    const [one] = await driver.agent.listComments(branch.worktree)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: one?.id ?? "",
      body: "done",
    })
    await driver.screen.pressKeys(["r"])

    // ACT
    await driver.screen.pressKeys(["shift+tab"])
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(panelOf(await driver.screen.getFrame())).toContain("Settled")
  })
})
