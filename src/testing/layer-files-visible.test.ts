import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.tsx", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

const railOf = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").map((row) => row.slice(0, 40))

describe("seeing what a layer covers", () => {
  it("lists every file of the layer it is standing on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runLayersSet(branch.worktree, {
      summary: "one layer over two files",
      layers: [
        {
          title: "Add the field and show it",
          spans: [
            { path: "src/api.ts", start: 2, end: 2 },
            { path: "src/ui.tsx", start: 2, end: 2 },
          ],
        },
      ],
    })
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const rail = railOf(await driver.screen.getFrame())
    expect(rail.some((row) => row.includes("api.ts"))).toBe(true)
    expect(rail.some((row) => row.includes("ui.tsx"))).toBe(true)
  })
})
