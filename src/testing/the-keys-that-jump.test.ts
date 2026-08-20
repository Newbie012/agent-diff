import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const held = 0"],
  after: ["const held = 0", `export const ${path.replace(/\W/g, "")} = 1`],
})

const files = Array.from({ length: 12 }, (_, at) => change(`src/file${at}.ts`))

const fileIn = (frame: string): string =>
  (frame.split("\n")[0] ?? "").split(/\s{2,}/)[2] ?? ""

describe("the keys that jump", () => {
  it("moves the file list when the file list has focus", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 140, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["shift+tab"])
    const started = fileIn(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    const landed = fileIn(await driver.screen.getFrame())
    expect(started).not.toBe(landed)
    expect(landed).toContain("file9")

    // ACT
    await driver.screen.pressKeys(["g"])

    // ASSERT
    expect(fileIn(await driver.screen.getFrame())).toBe(started)
  })

  it("still moves the diff when the diff has focus", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 140, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    const started = fileIn(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(fileIn(await driver.screen.getFrame())).toBe(started)
  })
})
