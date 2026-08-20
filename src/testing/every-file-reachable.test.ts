import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const spread = (count: number) =>
  Array.from({ length: count }, (_, at) => ({
    path: `src/${at % 3 === 0 ? "one" : at % 3 === 1 ? "two" : "three"}/file${at}.ts`,
    before: ["const a = 1"],
    after: ["const a = 1", "const b = 2"],
  }))

const holdingBack = (frame: string): string | undefined =>
  frame.match(/… \d+ more/)?.[0]

const at = (count: number) =>
  it(`never holds one row back with ${count} files`, async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: `count-${count}`, files: spread(count) })

    // ACT
    await driver.screen.open({ width: 100, height: 14, review: true })

    // ASSERT
    expect(holdingBack(await driver.screen.getFrame())).not.toBe("… 1 more")
  })

describe("the file list", () => {
  at(9)
  at(10)
  at(11)
  at(12)
  at(13)
})
