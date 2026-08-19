import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

describe("asking the agent for a reading order", () => {
  it("hands the agent the request when the branch has no layers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["L"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("asked for a reading order")
    const taken = await driver.agent.listComments(branch.worktree)
    expect(taken.map((one) => one.body).join("\n")).toContain("adiff layers set")
  })

  it("says the order is stale when it is, so the agent reads the diff again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One layer",
      layers: [{ title: "The change", spans: [{ path: "src/one.ts", start: 1, end: 2 }] }],
    })
    await driver.branch.setFile(branch, "src/one.ts", ["const a = 1", "const one = 2", "const two = 3"])
    await driver.branch.commitAll(branch, "one more line")
    await driver.screen.open({ width: 120, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["L"])

    // ASSERT
    const taken = await driver.agent.listComments(branch.worktree)
    expect(taken.map((one) => one.body).join("\n")).toContain("older commit")
  })
})
