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

describe("choosing which branch needs you", () => {
  it("says nothing is unanswered when the agent has taken every comment", async () => {
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
      branches: [{ branch: branch.name, unread: 1 }],
    })
  })

  it("says how many the agent has not collected", async () => {
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
      branches: [{ branch: branch.name, unread: 1 }],
    })
  })

  it("shows the counts on the branches screen", async () => {
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
    const row = rows.find((line) => line.includes("cdr-1-add-third"))
    expect(row).toContain("1 unanswe")
  })
})

describe("coming back to the branch list", () => {
  it("shows a comment sent since the list was last drawn", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN", "c"])
    await driver.screen.typeText("hold this")
    await driver.screen.pressCtrl("s")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const row = rows.find((line) => line.includes("cdr-1-add-third"))
    expect(row).toContain("1 unanswe")
  })
})
