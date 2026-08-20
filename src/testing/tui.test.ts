import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when a review is read on the terminal", () => {
  test("then adiff opens on the branches with something to review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("add-a-third-line")
  })

  test("then the changed lines show once a branch is opened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [
        {
          path: "src/api.ts",
          before: ["const kept = 1"],
          after: ["const kept = 1", "const added = 2"],
        },
      ],
    })
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api.ts")
    expect(frame).toContain("const added = 2")
  })

  test("then a comment written on the terminal reaches the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [
        {
          path: "src/api.ts",
          before: ["const kept = 1"],
          after: ["const kept = 1", "const added = 2"],
        },
      ],
    })
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN", "c"])
    await driver.screen.typeText("why add this")
    await driver.screen.pressKeys([""])

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toEqual([
      {
        id: expect.any(String),
        body: "why add this",
        file: "src/api.ts",
        side: "new",
        start: 2,
        end: 2,
        snippet: "const added = 2",
      },
    ])
  })
})
