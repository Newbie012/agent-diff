import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const before = 1"],
  after: ["const before = 1", "const after = 2"],
})

const nested = { files: [change("src/api/one.ts"), change("src/api/two.ts"), change("docs/notes.md")] }

const pane = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(2)
    .map((line) => line.slice(0, 38).trimEnd())
    .filter((line) => line.trim().length > 0)

describe("reading the file tree", () => {
  it("shows a directory as open or closed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open({ review: true })

    // ACT
    const open = pane(await driver.screen.getFrame())
    await driver.screen.pressKeys(["h"])
    const shut = pane(await driver.screen.getFrame())

    // ASSERT
    expect(open.some((line) => line.includes("▾"))).toBe(true)
    expect(shut.some((line) => line.includes("▸"))).toBe(true)
  })

  it("counts the files in a directory", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rows = pane(await driver.screen.getFrame())
    expect(rows.some((line) => line.includes("api"))).toBe(true)
    expect(rows.every((line) => !/\d+f\b/.test(line))).toBe(true)
  })

  it("marks a file that has a comment on it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("about this")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(pane(await driver.screen.getFrame()).some((line) => line.includes("1•"))).toBe(true)
  })
})
