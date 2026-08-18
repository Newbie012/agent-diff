import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/secret-name.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
}

const reported = async (driver: TestDriver, minimal: boolean): Promise<string> => {
  await driver.branch.create(oneFile)
  await driver.screen.open()
  await driver.screen.pressKeys(["RETURN", "j"])
  await driver.screen.pressKeys(["n"])
  await driver.screen.pressCtrl("b")
  await driver.screen.typeText("something went wrong")
  if (minimal) await driver.screen.pressCtrl("t")
  await driver.screen.pressCtrl("s")
  const dir = join(driver.storeRoot, "reports")
  const found = (await readdir(dir)).toSorted()
  return readFile(join(dir, found.at(-1) ?? ""), "utf8")
}

describe("reporting a bug", () => {
  it("carries the notices the reviewer was shown, with the clock", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const text = await reported(driver, false)

    // ASSERT
    expect(text).toMatch(/\d+:\d\d\s+said\s+\S/)
  })

  it("sends everything on screen by default", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const text = await reported(driver, false)

    // ASSERT
    expect(text).toContain("What led here")
    expect(text).toContain("secret-name.ts")
  })

  it("sends no file names or code when asked for the least", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const text = await reported(driver, true)

    // ASSERT
    expect(text).toContain("something went wrong")
    expect(text).not.toContain("What led here")
    expect(text).not.toContain("const b = 2")
  })
})
