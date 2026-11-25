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

type Listed = { readonly id: string; readonly about: string; readonly stand: string; readonly turns: ReadonlyArray<{ readonly voice: string }> }

const requestsOf = async (driver: TestDriver, worktree: string): Promise<ReadonlyArray<Listed>> =>
  ((await driver.app.run(["comment", "list", "--worktree", worktree])).envelope as { comments: ReadonlyArray<Listed> }).comments.filter(
    (one) => one.about === "branch",
  )

describe("when the reviewer asks for a reading order while an earlier request is still open", () => {
  test("then comment list holds one request about the branch, with the second ask added to it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.run(["layers", "ask", "--worktree", branch.worktree])

    // ACT
    await driver.app.run(["layers", "ask", "--worktree", branch.worktree])

    // ASSERT
    const requests = await requestsOf(driver, branch.worktree)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.turns.filter((turn) => turn.voice === "reviewer")).toHaveLength(1)
  })

  test("then pressing L twice in the terminal leaves one request about the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.screen.pressKeys(["L"])

    // ACT
    await driver.screen.pressKeys(["L"])

    // ASSERT
    expect(await requestsOf(driver, branch.worktree)).toHaveLength(1)
  })
})

describe("when the reviewer asks for a reading order after settling the last request", () => {
  test("then comment list holds a new open request beside the settled one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.run(["layers", "ask", "--worktree", branch.worktree])
    const [first] = await requestsOf(driver, branch.worktree)
    await driver.app.run(["comment", "resolve", "--worktree", branch.worktree, "--id", first?.id ?? ""])

    // ACT
    await driver.app.run(["layers", "ask", "--worktree", branch.worktree])

    // ASSERT
    const requests = await requestsOf(driver, branch.worktree)
    expect(requests.map((one) => one.stand).toSorted()).toEqual(["filed", "settled"])
  })
})
