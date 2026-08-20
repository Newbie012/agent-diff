import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
  { path: "src/three.ts", before: ["const c = 1"], after: ["const c = 1", "const three = 2"] },
  { path: "src/four.ts", before: ["const d = 1"], after: ["const d = 1", "const four = 2"] },
]

const marked = async (driver: TestDriver, branch: string, file: string): Promise<number> => {
  const result = await driver.app.run([
    "file",
    "review",
    "--repo",
    driver.repoPath,
    "--branch",
    branch,
    "--file",
    file,
  ])
  return result.code
}

describe("two writes to one review at the same moment", () => {
  it("keeps both of them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    const codes = await Promise.all(files.map((one) => marked(driver, branch.name, one.path)))

    // ASSERT
    expect(codes).toEqual(files.map(() => 0))

    // ASSERT
    const result = await driver.app.run([
      "review",
      "progress",
      "--repo",
      driver.repoPath,
      "--branch",
      branch.name,
    ])
    const report = JSON.parse(result.stdout) as { reviewed: ReadonlyArray<string> }
    expect(report.reviewed).toHaveLength(files.length)
  })
})
