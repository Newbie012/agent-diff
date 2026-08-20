import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

describe("when the agent is asked for a reading order", () => {
  test("then the agent gets the request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["L"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("asked for a reading order")
    const taken = await driver.agent.listComments(branch.worktree)
    expect(taken.map((one) => one.body).join("\n")).toContain("adiff layers set")
  })

  test("then the order is reported stale", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One layer",
      layers: [{ title: "The change", spans: [{ path: "src/one.ts", start: 1, end: 2 }] }],
    })
    await driver.branch.setFile(branch, "src/one.ts", ["const a = 1", "const one = 2", "const two = 3"])
    await driver.branch.commitAll(branch, "one more line")
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["L"])

    // ASSERT
    const taken = await driver.agent.listComments(branch.worktree)
    expect(taken.map((one) => one.body).join("\n")).toContain("older commit")
  })
})
