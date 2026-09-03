import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const spread = (count: number) =>
  Array.from({ length: count }, (_, at) => ({
    path: `src/${at % 3 === 0 ? "one" : at % 3 === 1 ? "two" : "three"}/file${at}.ts`,
    before: ["const a = 1"],
    after: ["const a = 1", "const b = 2"],
  }))

const holdingBack = (frame: string): string | undefined =>
  frame.match(/… \d+ more/)?.[0]

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ name: "many", files: spread(30) })
  await driver.screen.open({ width: 100, height: 14, review: true })
  await driver.screen.pressKeys(["TAB", "l", "l", "l", "l", "l", "l"])
}

describe("when the file list runs past the pane", () => {
  test("then the count reads how many rows are below", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await opened(driver)

    // ASSERT
    expect(holdingBack(await driver.screen.getFrame())).toMatch(/^… \d+ more$/)
  })

  test("then the count goes once nothing is below", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(holdingBack(await driver.screen.getFrame())).toBeUndefined()
  })
})
