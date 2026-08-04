import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const steps = (mark: string): ReadonlyArray<string> => [
  "export const run = () => {",
  ...Array.from({ length: 60 }, (_, at) => `  const step${at} = ${mark}(${at})`),
  "}",
]

const file = {
  files: [{ path: "src/run.ts", before: steps("settle"), after: steps("resolve") }],
}

const firstCodeRow = (frame: string): string =>
  frame.split("\n").find((line) => /│[▎●\s]*\d/.test(line)) ?? ""

describe("scrolling sideways", () => {
  it("leaves the diff where it is", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    const before = firstCodeRow(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("right", 8)
    await driver.screen.scroll("left", 8)

    // ASSERT
    expect(firstCodeRow(await driver.screen.getFrame())).toBe(before)
  })
})

describe("scrolling down and sideways at once", () => {
  it("moves by what the vertical events asked for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.burst(["down", "right", "down", "left", "down", "right"])
    const mixed = firstCodeRow(await driver.screen.getFrame())
    await driver.screen.pressKeys(["g"])
    await driver.screen.burst(["down", "down", "down"])

    // ASSERT
    expect(firstCodeRow(await driver.screen.getFrame())).toBe(mixed)
  })
})
