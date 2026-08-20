import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

describe("moving between layers and files", () => {
  it("offers the switch once a branch has layers, naming where it would go", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, {
      summary: "one layer",
      layers: [{ title: "Add the field", spans: [{ path: "src/api.ts", start: 2, end: 2 }] }],
    })

    // ACT
    await driver.screen.open({ review: true })
    await driver.screen.pressShiftTab()

    // ASSERT
    expect(await driver.screen.footer()).toContain("s file tree")

    // ACT
    await driver.screen.pressKeys(["s"])

    // ASSERT
    expect(await driver.screen.footer()).toContain("s layers")
  })

  it("says nothing about layers on a branch without any", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    expect(await driver.screen.footer()).not.toContain("s layers")
  })
})
