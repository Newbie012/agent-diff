import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"

const spread = shapes.find((shape) => shape.name.includes("several folders"))

const walk = async (driver: TestDriver, key: string, times: number): Promise<void> => {
  await Array.from({ length: times }).reduce<Promise<void>>(
    (waiting) => waiting.then(() => driver.screen.pressKeys([key])),
    Promise.resolve(),
  )
}

describe("pressing on past the last file", () => {
  it("says there is no next file rather than doing nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(spread?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await walk(driver, "]", (spread?.files.length ?? 1) - 1)

    // ACT
    await driver.screen.pressKeys(["]"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("last file")
  })

  it("says the same at the first file, going back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(spread?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })

    // ACT
    await driver.screen.pressKeys(["["])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("first file")
  })

  it("says nothing while there are still files to turn to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(spread?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })

    // ACT
    await driver.screen.pressKeys(["]"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("last file")
    expect(frame).not.toContain("first file")
  })
})
