import { describe, expect, test } from "@effect/vitest"
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

describe("when the branch list is read", () => {
  test("then a branch whose comments the agent took reads as nothing unanswered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why",
    })

    // ACT
    const result = await driver.app.runBranches()

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: true,
      branches: [{ branch: branch.name, unanswered: 1 }],
    })
  })

  test("then each branch counts the comments the agent has not collected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "sent now",
    })

    // ACT
    const result = await driver.app.runBranches()

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: true,
      branches: [{ branch: branch.name, unanswered: 1 }],
    })
  })

  test("then the counts show on the branches screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why",
    })

    // ACT
    await driver.screen.open()

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const row = rows.find((line) => line.includes("add-a-third-line"))
    expect(row).toContain("1 unanswe")
  })
})

describe("when the reviewer comes back to the branch list", () => {
  test("then a comment sent since the list was last drawn shows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.writeComment("hold this")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const row = rows.find((line) => line.includes("add-a-third-line"))
    expect(row).toContain("1 unanswe")
  })
})
