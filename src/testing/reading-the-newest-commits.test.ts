import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }]

const threeCommits = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.branch.changeAndCommit(
    branch,
    "src/api.ts",
    ["const a = 1", "const b = 2", "const c = 3"],
    "add the third line",
  )
  await driver.branch.changeAndCommit(
    branch,
    "src/api.ts",
    ["const a = 1", "const b = 2", "const c = 3", "const d = 4"],
    "add the fourth line",
  )
  await driver.screen.open({ width: 150, height: 30, review: true })
}

describe("when a reviewer wants only the newest commit", () => {
  test("then the base picker offers the last commit by its message", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await threeCommits(driver)

    // ACT
    await driver.screen.pressKeys(["b"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the last commit")
    expect(frame).toContain("add the fourth line")
  })

  test("then picking it leaves the diff holding that commit alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await threeCommits(driver)
    await driver.screen.pressKeys(["b"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const added = rows.filter((row) => /\+\s+const/.test(row))
    expect(added).toHaveLength(1)
    expect(added[0]).toContain("const d = 4")
  })
})
