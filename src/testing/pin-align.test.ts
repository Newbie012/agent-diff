import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const steps = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `    const step${index} = ${mark}(${index})`)

const shaped = (mark: string): ReadonlyArray<string> => [
  "export const client = async (input: string) => {",
  ...steps(40, mark),
  "  return input",
  "}",
]

const file = { files: [{ path: "src/client.ts", before: shaped("settle"), after: shaped("resolve") }] }

describe("the pinned line sits over the code it names", () => {
  it("starts in the same column as the code below it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const pin = rows.find((line) => line.includes("export const client"))
    const code = rows.find((line) => line.includes("const step3"))
    expect(pin).toBeDefined()
    expect(code).toBeDefined()
    expect((pin ?? "").indexOf("export const client")).toBe(
      (code ?? "").indexOf("const step3") - 4,
    )
  })
})
