import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["export const held = 0"],
  after: ["export const held = 0", `export const ${path.replace(/\W/g, "")} = 1`],
})

const files = [change("src/one.ts"), change("src/two.ts"), change("src/three.ts")]

const layered = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.app.runLayersSet(branch.worktree, {
    summary: "Two layers over three files.",
    layers: [
      {
        title: "The pair",
        note: "Read these together.",
        spans: [
          { path: "src/one.ts", start: 1, end: 2 },
          { path: "src/two.ts", start: 1, end: 2 },
        ],
      },
      { title: "The last one", note: "Then this.", spans: [{ path: "src/three.ts", start: 1, end: 2 }] },
    ],
  })
  await driver.screen.open({ width: 120, height: 30 })
  await driver.screen.pressKeys(["RETURN"])
}

const fileIn = (frame: string): string => (frame.split("\n")[0] ?? "").split(/\s{2,}/)[2] ?? ""

describe("reading a layer a file at a time", () => {
  it("lists the files of a layer as rows of the rail", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await layered(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("one.ts")
    expect(frame).toContain("two.ts")
  })

  it("says how many of a layer's files have been read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)
    expect(await driver.screen.getFrame()).toContain("0/2")

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1/2")
  })

  it("walks from the last file of one layer into the first of the next", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)
    await driver.screen.pressKeys(["shift+tab"])
    const started = fileIn(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["j", "j"])

    // ASSERT
    const landed = fileIn(await driver.screen.getFrame())
    expect(started).toContain("one.ts")
    expect(landed).toContain("three.ts")
  })
})
