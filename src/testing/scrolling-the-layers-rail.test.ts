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
    summary: "Twelve files over six layers",
    layers: files.map((file, at) => ({
      title: `The layer numbered ${at}`,
      spans: [{ path: file.path, start: 1, end: 2 }],
    })),
  })
  await driver.screen.open({ width: 130, height: 24 })
  await driver.screen.pressKeys(["RETURN"])
}

const fileIn = (frame: string): string => (frame.split("\n")[0] ?? "").split(/\s{2,}/)[2] ?? ""

describe("scrolling the layers rail with a wheel", () => {
  it("moves the view and leaves the file you are reading alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)
    const before = await driver.screen.getFrame()

    // ACT
    await driver.screen.scrollTree("down", 4)

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(after).not.toBe(before)
    expect(fileIn(after)).toBe(fileIn(before))
  })

  it("stops at the end rather than walking on for as long as the wheel turns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)

    // ACT
    await driver.screen.scrollTree("down", 40)
    const landed = await driver.screen.getFrame()
    await driver.screen.scrollTree("down", 40)

    // ASSERT
    expect(await driver.screen.getFrame()).toBe(landed)
  })

  it("comes back to the file you are on when you move with the keys", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)
    const before = await driver.screen.getFrame()
    await driver.screen.scrollTree("down", 20)
    expect(await driver.screen.getFrame()).not.toBe(before)

    // ACT
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["["])

    // ASSERT
    expect(await driver.screen.getFrame()).toBe(before)
  })
})
