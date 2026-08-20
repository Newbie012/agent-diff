import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lines = (mark: string): ReadonlyArray<string> =>
  Array.from({ length: 60 }, (_, at) => `const ${mark}${at} = ${at};`)

const twoFiles = {
  files: [
    { path: "src/api.ts", before: [], after: lines("api") },
    { path: "src/web.ts", before: [], after: lines("web") },
  ],
}

const open = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(twoFiles)
  await driver.screen.open({ width: 100, height: 20, review: true })
}

describe("when the reviewer turns to another file", () => {
  test("then the new file starts at its top", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    await driver.screen.scroll("down", 20)
    expect(await driver.screen.getFrame()).not.toContain("const api0 =")

    // ACT
    await driver.screen.pressKeys(["]"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("const web0 =")
  })
})
