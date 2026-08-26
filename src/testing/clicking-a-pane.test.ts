import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/first.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  { path: "src/second.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
]

describe("when a reviewer clicks a file in the list", () => {
  test("then the file under the pointer opens and the list takes the keys", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    const y = await driver.screen.rowAtText("second.ts")

    // ACT
    await driver.screen.clickAt(12, y)

    // ASSERT
    expect((await driver.screen.getFrame()).split("\n")[0]).toContain("second.ts")
    expect((await driver.screen.believes()).focus).toBe("file list")
  })
})

describe("when a reviewer clicks a thread in the review panel", () => {
  test("then the panel takes the keys and the cursor stands on the thread under the pointer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("a point about the first file")
    const y = await driver.screen.rowAtText("a point about the first")

    // ACT
    await driver.screen.clickAt(135, y)

    // ASSERT
    expect((await driver.screen.believes()).focus).toBe("review panel")
  })
})

const twoLayers = {
  summary: "Two layers over two files",
  layers: [
    { title: "The first file", spans: [{ path: "src/first.ts", start: 2, end: 2 }] },
    { title: "The second file", spans: [{ path: "src/second.ts", start: 2, end: 2 }] },
  ],
}

describe("when a reviewer clicks a layer in the rail", () => {
  test("then the diff moves to the code the layer under the pointer claims", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 150, height: 30, review: true })
    const y = await driver.screen.rowAtText("The second file")

    // ACT
    await driver.screen.clickAt(12, y)

    // ASSERT
    expect((await driver.screen.getFrame()).split("\n")[0]).toContain("second.ts")
    expect((await driver.screen.believes()).focus).toBe("file list")
  })
})

describe("when a reviewer clicks in the diff", () => {
  test("then the diff takes the keys back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["tab"])
    expect((await driver.screen.believes()).focus).toBe("review panel")

    // ACT
    await driver.screen.clickOnDiff(4)

    // ASSERT
    expect((await driver.screen.believes()).focus).toBe("diff")
  })
})
