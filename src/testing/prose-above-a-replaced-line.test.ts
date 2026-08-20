import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/core.ts",
    before: ["export type Entry = { id: string }", "const tail = 0"],
    after: ["export type Entry = { id: string; amount: number }", "const tail = 0"],
  },
]

const rowsOf = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").map((line) => (line.split("││")[1] ?? "").split("│")[0] ?? "")

describe("a layer's note about a replaced line", () => {
  it("sits above the pair, not between the two halves of it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One claim",
      layers: [
        {
          title: "Entry gains an amount",
          note: "The sum loop becomes a reduce.",
          spans: [{ path: "src/core.ts", start: 1, end: 1 }],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 150, height: 26, review: true })

    // ASSERT
    const rows = rowsOf(await driver.screen.getFrame())
    const said = rows.findIndex((row) => row.includes("becomes a reduce"))
    const gone = rows.findIndex((row) => row.includes("-") && row.includes("Entry = { id: string }"))
    const came = rows.findIndex((row) => row.includes("+") && row.includes("amount: number"))
    expect(said).toBeGreaterThan(-1)
    expect(gone).toBeGreaterThan(-1)
    expect(came).toBeGreaterThan(gone)
    expect(said).toBeLessThan(gone)
  })
})
