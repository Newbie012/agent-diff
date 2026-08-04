import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

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
  const rows = await driver.screen.findHighlighted(palette.cursor)
  return rows[0] ?? ""
}

describe("moving around a long diff", () => {
  it("jumps to the end of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoHunks)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(await cursorOn(driver)).toContain("export default wide")
  })

  it("comes back to the start", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoHunks)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["G"])

    // ACT
    await driver.screen.pressKeys(["g"])

    // ASSERT
    expect(await cursorOn(driver)).toContain("export function wide")
  })

  it("jumps to the next hunk, skipping the context between them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoHunks)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["}"])

    // ASSERT
    expect(await cursorOn(driver)).toContain("keep37")
  })
})
