import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/grid.ts", before: ["const a = 1"], after: ["const a = 1", "const grid = 2"] },
  { path: "src/page.ts", before: ["const b = 1"], after: ["const b = 1", "const page = 2"] },
]

const SUMMARY = "Replaces the old table with a DataGrid, then moves each page onto it."

const LONG = `${SUMMARY} ${"It goes on at some length about the reasoning. ".repeat(8)}`

const layered = async (driver: TestDriver, summary: string): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.app.runLayersSet(branch.worktree, {
    summary,
    layers: [
      { title: "The grid itself", note: "Read this first.", spans: [{ path: "src/grid.ts", start: 1, end: 2 }] },
      { title: "The page", note: "Then this.", spans: [{ path: "src/page.ts", start: 1, end: 2 }] },
    ],
  })
}

describe("what the layers say the branch is", () => {
  it("says it above the layers, where the reviewer starts", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver, SUMMARY)

    // ACT
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Replaces the old")
    expect(frame.indexOf("Replaces the old")).toBeLessThan(frame.indexOf("The grid itself"))
  })

  it("keeps a long one from crowding out the layers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver, LONG)

    // ACT
    await driver.screen.open({ width: 120, height: 16 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("The grid itself")
    expect(frame).toContain("…")
  })

  it("says nothing where a branch has no layers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Replaces the old")
  })
})
