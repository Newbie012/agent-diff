import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const twoHunks = (mark: string): ReadonlyArray<string> => [
  `const first = "${mark}"`,
  ...Array.from({ length: 40 }, (_, at) => `const kept${at} = ${at}`),
  `const last = "${mark}"`,
]

const spread = {
  files: [{ path: "src/spread.ts", before: twoHunks("before"), after: twoHunks("after") }],
}

const ESC = ""

const kitty = (key: number, shifted: number): string => `${ESC}[${key}:${shifted};2u`

describe("when the terminal reports a key as shifted", () => {
  test("then question mark opens the key sheet", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 130, height: 26, review: true })

    // ACT
    await driver.screen.pressKeys([kitty(47, 63)])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Keys here")
    expect(frame).not.toContain("elsewhere")
  })

  test("then plus widens the context", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open({ width: 130, height: 26, review: true })
    expect(await driver.screen.getFrame()).toContain("34 lines hidden")

    // ACT
    await driver.screen.pressKeys([kitty(61, 43)])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("20 lines hidden")
  })
})
