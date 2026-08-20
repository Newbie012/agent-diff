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
    await driver.screen.open({ width: 150, height: 34, review: true })
    await driver.screen.writeComment("is this right")
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
    expect(panel).not.toContain("Not picked up")
  })

  it("gives a settled thread a section of its own", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 34, review: true })
    await driver.screen.writeComment("a point to close")
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

describe("a thread you removed", () => {
  it("leaves the diff, stays in the review, and comes back with the same key", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 34, review: true })
    await driver.screen.writeComment("on reflection, no")

    // ACT
    await driver.screen.pressKeys(["shift+tab"])
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const gone = await driver.screen.getFrame()
    expect(gone).toContain("Removed")
    expect(gone.split("Removed")[0] ?? "").not.toContain("on reflection, no")

    // ACT
    await driver.screen.pressKeys(["shift+tab"])
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const back = await driver.screen.getFrame()
    expect(back).not.toContain("Removed")
    expect(back).toContain("on reflection, no")
  })
})
