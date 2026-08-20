import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `  const ${mark}${index} = ${index}`)

const twoHunks = {
  files: [
    {
      path: "src/wide.ts",
      before: ["export function wide() {", ...filler(40, "keep"), "}", "export default wide"],
      after: [
        "export function wide() {",
        "  const first = 1",
        ...filler(40, "keep"),
        "  const last = 2",
        "}",
        "export default wide",
      ],
    },
  ],
}

const cursorOn = async (driver: TestDriver): Promise<string> => {
  const rows = await driver.screen.findUnderCursor()
  return rows[0] ?? ""
}

describe("when the reviewer moves around a long diff", () => {
  test("then the cursor jumps to the end of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoHunks)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(await cursorOn(driver)).toContain("export default wide")
  })

  test("then the cursor comes back to the start", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoHunks)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["G"])

    // ACT
    await driver.screen.pressKeys(["g"])

    // ASSERT
    expect(await cursorOn(driver)).toContain("export function wide")
  })

  test("then the cursor jumps from one change to the next", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoHunks)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["}", "}"])

    // ASSERT
    expect(await cursorOn(driver)).toContain("const last = 2")
  })
})
