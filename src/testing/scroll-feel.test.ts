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
    expect(after).toContain("   9 ")
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
