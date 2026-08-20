import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"

const spread = shapes.find((shape) => shape.name.includes("several folders"))

const walk = async (driver: TestDriver, key: string, times: number): Promise<void> => {
  await Array.from({ length: times }).reduce<Promise<void>>(
    (waiting) => waiting.then(() => driver.screen.pressKeys([key])),
    Promise.resolve(),
  )
}

describe("when the reviewer presses on past the last file", () => {
  test("then adiff says there is no next file", async () => {
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

  test("then adiff says there is no previous file at the first one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(spread?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })

    // ACT
    await driver.screen.pressKeys(["["])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("first file")
  })

  test("then adiff says nothing while there are files to turn to", async () => {
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
