import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const steps = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `  const step${index} = ${mark}(${index})`)

const buried = (mark: string): ReadonlyArray<string> => [
  "import { logger } from './logger'",
  "import { client } from './client'",
  "",
  "type Options = {",
  "  readonly tenant: string",
  "}",
  "",
  "export const run = async (options: Options) => {",
  ...steps(40, mark),
  "}",
]

const file = { files: [{ path: "src/run.ts", before: buried("settle"), after: buried("resolve") }] }

const firstCodeRow = (frame: string): string =>
  frame.split("\n").find((line) => /│[▎●\s]*\d+/.test(line)) ?? ""

describe("how scrolling feels", () => {
  it("moves more than one line per notch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    const before = firstCodeRow(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("down", 1)

    // ASSERT
    const after = firstCodeRow(await driver.screen.getFrame())
    expect(before).toContain("   6 ")
    expect(after).toContain("   8 ")
  })
})

const long = (mark: string): ReadonlyArray<string> => [
  "export function scheduler() {",
  ...steps(300, mark),
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
  await driver.screen.open()
  await driver.screen.pressKeys(["RETURN"])
}

describe("a burst of wheel events", () => {
  it("lands where the same notches land one at a time", async () => {
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

  it("nets out when the burst turns around", async () => {
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

  it("settles a long burst as quickly as a short one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openDiff(driver)
    const short = await driver.screen.burst(wheel(8, "down"))
    await driver.screen.scroll("up", 40)

    // ACT
    const drain = await driver.screen.burst(wheel(600, "down"))

    // ASSERT
    expect(drain).toBeLessThan(short * 3)
  })
})

describe("lines above the first change", () => {
  it("counts what the diff omits at the top of the file", async () => {
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

describe("expanding to the whole file", () => {
  it("reaches the top of a file the diff starts deep inside", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [{ path: "src/deep.ts", before: deep("settle"), after: deep("resolve") }],
    })
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["=", "=", "=", "="])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("lines hidden")
  })
})
