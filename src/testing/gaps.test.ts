import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number, from: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `const kept${from + index} = ${from + index}`)

const twoHunks = (mark: string): ReadonlyArray<string> => [
  `const first = "${mark}"`,
  ...filler(40, 0),
  `const last = "${mark}"`,
]

const spread = {
  files: [{ path: "src/spread.ts", before: twoHunks("before"), after: twoHunks("after") }],
}

describe("when the diff skips lines", () => {
  test("then the diff counts the lines it is not showing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toMatch(/34 lines hidden/)
  })

  test("then the count goes once the context is wide enough", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.typeText("+")
    await driver.screen.typeText("+")
    await driver.screen.typeText("+")

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("lines hidden")
  })
})
