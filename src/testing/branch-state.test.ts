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
  it("says how many comments are waiting to be sent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runStage({
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
      branches: [{ branch: branch.name, staged: 1, unread: 0 }],
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
      branches: [{ branch: branch.name, staged: 0, unread: 1 }],
    })
  })

  it("shows the counts on the branches screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runStage({
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
    expect(row).toContain("1 staged")
  })
})

describe("coming back to the branch list", () => {
  it("shows work staged since the list was last drawn", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN", "c"])
    await driver.screen.typeText("hold this")
    await driver.screen.pressCtrl("a")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const row = rows.find((line) => line.includes("cdr-1-add-third"))
    expect(row).toContain("1 staged")
  })
})
