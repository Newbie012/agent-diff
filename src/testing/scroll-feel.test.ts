import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const layers = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `  const layer${index} = ${mark}(${index})`)

const buried = (mark: string): ReadonlyArray<string> => [
  "import { logger } from './logger'",
  "import { client } from './client'",
  "",
  "type Options = {",
  "  readonly tenant: string",
  "}",
  "",
  "export const run = async (options: Options) => {",
  ...layers(40, mark),
  "}",
]

const file = { files: [{ path: "src/run.ts", before: buried("settle"), after: buried("resolve") }] }

const firstCodeRow = (frame: string): string =>
  frame.split("\n").find((line) => /│[▎●\s]*\d+/.test(line)) ?? ""

describe("when the wheel turns one notch", () => {
  test("then the diff moves one line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ review: true })

    const before = firstCodeRow(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("down", 2)

    // ASSERT
    const after = firstCodeRow(await driver.screen.getFrame())
    expect(before).toContain("   6 ")
    expect(after).toContain("   7 ")
  })
})

const long = (mark: string): ReadonlyArray<string> => [
  "export function scheduler() {",
  ...layers(300, mark),
  "}",
]

const repo = {
  files: Array.from({ length: 24 }, (_, index) => ({
    path: `src/jobs/worker${index}.ts`,
    before: long("settle"),
    after: long("resolve"),
  })),
}

const wheel = (count: number, direction: "up" | "down"): ReadonlyArray<"up" | "down"> =>
  Array.from({ length: count }, () => direction)

const openDiff = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(repo)
  await driver.screen.open({ review: true })
}

describe("when a burst of wheel events arrives", () => {
  test("then the burst lands where the same notches land one at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openDiff(driver)
    await driver.screen.scrollSlowly("down", 20)
    const slowly = firstCodeRow(await driver.screen.getFrame())
    await driver.screen.scroll("up", 40)

    // ACT
    await driver.screen.burst(wheel(20, "down"))

    // ASSERT
    expect(firstCodeRow(await driver.screen.getFrame())).toBe(slowly)
  })

  test("then a burst that turns around nets out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openDiff(driver)
    await driver.screen.scroll("down", 1)
    const oneNotch = firstCodeRow(await driver.screen.getFrame())
    await driver.screen.scroll("up", 10)

    // ACT
    await driver.screen.burst([...wheel(30, "down"), ...wheel(29, "up")])

    // ASSERT
    expect(firstCodeRow(await driver.screen.getFrame())).toBe(oneNotch)
  })

  test("then the first frame after the burst carries all of it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openDiff(driver)

    // ACT
    await driver.screen.fire(wheel(600, "down"))
    const firstFrame = firstCodeRow(await driver.screen.getFrame())
    await driver.screen.rest()

    // ASSERT
    expect(firstCodeRow(await driver.screen.getFrame())).toBe(firstFrame)
  })
})

describe("when lines sit above the first change", () => {
  test("then the diff counts what it omits at the top of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("5 lines hidden")
  })
})

const deep = (mark: string): ReadonlyArray<string> => [
  ...Array.from({ length: 200 }, (_, index) => `const preamble${index} = ${index}`),
  `export const run = () => ${mark}()`,
]

describe("when the context expands to the whole file", () => {
  test("then scrolling reaches the top of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [{ path: "src/deep.ts", before: deep("settle"), after: deep("resolve") }],
    })
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["=", "=", "=", "="])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("lines hidden")
  })
})
