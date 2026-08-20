import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const rail = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").slice(2).map((line) => line.slice(0, 34))

const railHas = (frame: string, name: string): boolean =>
  rail(frame).some((line) => line.includes(name))

const many = {
  files: Array.from({ length: 40 }, (_, at) => ({
    path: `src/part${String(Math.floor(at / 5))}/file${String(at).padStart(2, "0")}.ts`,
    before: ["const a = 1"],
    after: ["const a = 1", "const b = 2"],
  })),
}

const openTree = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(many)
  await driver.screen.open({ width: 120, height: 20, review: true })
}

describe("when the wheel turns over the file tree", () => {
  test("then the list moves and the file stays", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openTree(driver)
    const first = await driver.screen.getFrame()

    // ACT
    await driver.screen.scrollTree("down", 4)

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(railHas(first, "file00.ts")).toBe(true)
    expect(railHas(after, "file00.ts")).toBe(false)
    expect(after.split("\n")[0]).toContain("file00.ts")
  })

  test("then the list comes back to where it started", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openTree(driver)
    await driver.screen.scrollTree("down", 6)

    // ACT
    await driver.screen.scrollTree("up", 6)

    // ASSERT
    expect(railHas(await driver.screen.getFrame(), "file00.ts")).toBe(true)
  })
})
