import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const layers = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `    const layer${index} = ${mark}(${index})`)

const shaped = (mark: string): ReadonlyArray<string> => [
  "import { logger } from './logger'",
  "",
  "export type ClientInput = {",
  "  readonly tenant: string",
  "}",
  "",
  "export const client = async (input: ClientInput) => {",
  ...layers(40, mark),
  "  return input",
  "}",
]

const file = { files: [{ path: "src/client.ts", before: shaped("settle"), after: shaped("resolve") }] }

const pinnedRows = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => line.slice(36).trim())
    .filter((line) => line.startsWith("export "))

describe("when the scope the reviewer is inside is pinned", () => {
  test("then the pin names the enclosing function", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.scroll("down", 6)

    // ASSERT
    const shown = pinnedRows(await driver.screen.getFrame())
    expect(shown[0]).toContain("export const client = async")
    expect(shown[0]).not.toContain("ClientInput = {")
  })
})

describe("when the sign column is drawn", () => {
  test("then context and changed code start in the same column", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ review: true })

    // ACT
    const rows = (await driver.screen.getFrame()).split("\n")

    // ASSERT
    const context = rows.find((line) => line.includes("export const client = async"))
    const changed = rows.find((line) => line.includes("const layer0 = "))
    expect(context).toBeDefined()
    expect(changed).toBeDefined()
    expect((changed ?? "").indexOf("const layer0")).toBe(
      (context ?? "").indexOf("export const client") + 4,
    )
  })
})
