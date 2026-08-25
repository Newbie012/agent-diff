import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (from: number, to: number): ReadonlyArray<string> =>
  Array.from({ length: to - from + 1 }, (_, at) => `  const step${from + at} = ${from + at}`)

const shaped = (head: string, middle: string): ReadonlyArray<string> => [
  head,
  ...filler(2, 20),
  middle,
  ...filler(22, 40),
  "}",
]

const before = shaped("export const total = (rows) => {", "  return rows.length")
const after = shaped("export function total(rows) {", "  return rows.filter(kept)")
const fixed = shaped("export function total(rows) {", "  return rows.length")

const files = [{ path: "src/total.ts", before, after }]

const seed = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.screen.open({ width: 150, height: 26, review: true })
  await driver.screen.pressKeys(["}", "j"])
  await driver.screen.writeComment("Boolean drops a legitimate zero")
  await driver.branch.changeAndCommit(branch, "src/total.ts", fixed, "keep the zero")
  await driver.screen.pressKeys(["r"])
  await driver.screen.pressKeys(["tab"])
}

describe("when the agent has changed the line a comment was written on", () => {
  test("then the review panel shows the code the comment was written on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await seed(driver)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("return rows.filter(kept)")
  })

  test("then the panel says the diff no longer has that line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await seed(driver)

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("the diff no longer has that line")
  })
})
