import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const looking = async (driver: TestDriver, word: string): Promise<string> => {
  await driver.screen.pressKeys(["?"])
  await driver.screen.typeText(word)
  const frame = await driver.screen.getFrame()
  await driver.screen.pressEscape()
  return frame
}

describe("when a reviewer types a word for a command", () => {
  test("then the command is found behind the word", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 34, review: true })

    // ASSERT
    expect(await looking(driver, "resolve")).toContain("Settle")
    expect(await looking(driver, "search")).toContain("Search this branch")
    expect(await looking(driver, "shortcuts")).toContain("Keys")
  })
})
