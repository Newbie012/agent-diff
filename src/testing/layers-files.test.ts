import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.tsx", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

const backwards = {
  summary: "One layer over both files",
  layers: [
    {
      title: "Touch the view before the api",
      spans: [
        { path: "src/ui.tsx", start: 2, end: 2 },
        { path: "src/api.ts", start: 2, end: 2 },
      ],
    },
  ],
}

describe("when a layer spans several files", () => {
  test("then the walk follows the order the layer lists", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runLayersSet(branch.worktree, backwards)
    await driver.screen.open({ review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/ui.tsx")

    // ACT
    await driver.screen.pressKeys(["]"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/api.ts")
  })
})
