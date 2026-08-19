import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

const footerOf = (frame: string): string => {
  const rows = frame.split("\n").filter((row) => row.trim().length > 0)
  return rows.at(-1) ?? ""
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
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressShiftTab()

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).toContain("s file tree")

    // ACT
    await driver.screen.pressKeys(["s"])

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).toContain("s layers")
  })

  it("says nothing about layers on a branch without any", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).not.toContain("s layers")
  })
})
