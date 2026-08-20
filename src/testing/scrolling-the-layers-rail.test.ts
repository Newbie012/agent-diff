import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["export const held = 0"],
  after: ["export const held = 0", "export const one = 1"],
})

const files = Array.from({ length: 12 }, (_, at) => change(`src/part${at}/thing.ts`))

const layered = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.app.runLayersSet(branch.worktree, {
    summary: "Twelve files over twelve layers",
    layers: files.map((file, at) => ({
      title: `The layer numbered ${at}`,
      spans: [{ path: file.path, start: 1, end: 2 }],
    })),
  })
  await driver.screen.open({ width: 130, height: 24 })
  await driver.screen.pressKeys(["RETURN"])
}

const fileIn = (frame: string): string => (frame.split("\n")[0] ?? "").split(/\s{2,}/)[2] ?? ""

describe("a wheel over the layers rail", () => {
  it("moves one file at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)
    const before = fileIn(await driver.screen.getFrame())

    // ACT
    await driver.screen.scrollTree("down", 1)

    // ASSERT
    const after = fileIn(await driver.screen.getFrame())
    expect(after).not.toBe(before)
    expect(after).toContain("part1")
  })

  it("stops where the gesture stopped, rather than running on to the end", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)

    // ACT
    await driver.screen.flickTree("down", 40)

    // ASSERT
    expect(fileIn(await driver.screen.getFrame())).not.toContain("part11")
  })
})
