import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const held = 0"],
  after: ["const held = 0", `export const ${path.replace(/\W/g, "")} = 1`],
})

const files = [change("src/one.ts"), change("src/two.ts"), change("src/three.ts")]

const railOf = (frame: string): string =>
  frame
    .split("\n")
    .map((line) => line.split("│")[1] ?? "")
    .join("\n")

describe("when every file of a layer has been read", () => {
  test("then the rail keeps the layer marked read once its files are hidden", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "Two steps",
      layers: [
        {
          title: "The first step",
          spans: [
            { path: "src/one.ts", start: 1, end: 2 },
            { path: "src/two.ts", start: 1, end: 2 },
          ],
        },
        { title: "The second step", spans: [{ path: "src/three.ts", start: 1, end: 2 }] },
      ],
    })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["m"])
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["m"])
    await driver.screen.pressKeys(["]"])
    expect(railOf(await driver.screen.getFrame())).toContain("✓")

    // ACT
    await driver.screen.pressKeys(["f"])

    // ASSERT
    const rail = railOf(await driver.screen.getFrame())
    expect(rail).toContain("✓")
    expect(rail).toContain("2 of 2 files read")
  })
})
