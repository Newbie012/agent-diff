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
  await driver.screen.open({ width: 150, height: 30, review: true })
  await driver.screen.pressKeys(["}", "j"])
  await driver.screen.writeComment("kept drops a legitimate zero")
  await driver.branch.changeAndCommit(branch, "src/total.ts", fixed, "keep the zero")
  await driver.screen.pressKeys(["r"])
  await driver.screen.pressKeys(["tab"])
}

describe("when the branch has moved past the code a comment was written on", () => {
  test("then the section counts the comments and not the row that folds them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    await seed(driver)

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const head = rows.find((row) => row.includes("The branch moved past")) ?? ""
    expect(head).toContain("1")
    expect(head).not.toContain("2")
  })

  test("then the count stands whether the fold is open or shut", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await seed(driver)
    const headOf = async (): Promise<string> =>
      (await driver.screen.getFrame()).split("\n").find((row) => row.includes("moved past")) ?? ""
    const shut = await headOf()

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(await headOf()).toBe(shut)
  })

  test("then the review panel folds that comment away and counts it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await seed(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("The branch moved past")
    expect(frame).not.toContain("kept drops a legitimate zero")
  })

  test("then opening the fold lists the comment again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await seed(driver)

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("kept drops a legitimate zero")
  })
})
