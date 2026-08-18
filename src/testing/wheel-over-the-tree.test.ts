import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const chosen = (frame: string): string =>
  frame.split("\n").find((line) => line.includes("src/file")) ?? ""

const many = {
  files: Array.from({ length: 6 }, (_, at) => ({
    path: `src/file${String(at).padStart(2, "0")}.ts`,
    before: ["const a = 1"],
    after: ["const a = 1", "const b = 2"],
  })),
}

const openTree = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(many)
  await driver.screen.open({ width: 120, height: 20 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("the wheel over the file tree", () => {
  it("walks the files", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openTree(driver)
    const first = await driver.screen.getFrame()

    // ACT
    await driver.screen.scrollTree("down", 3)

    // ASSERT
    expect(chosen(first)).toContain("file00.ts")
    expect(chosen(await driver.screen.getFrame())).not.toContain("file00.ts")
  })

  it("walks back up again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openTree(driver)
    await driver.screen.scrollTree("down", 5)

    // ACT
    await driver.screen.scrollTree("up", 5)

    // ASSERT
    expect(chosen(await driver.screen.getFrame())).toContain("file00.ts")
  })
})
