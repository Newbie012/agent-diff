import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "pkg/plain.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  { path: "pkg/résumé.ts", before: ["const c = 1"], after: ["const c = 1", "const d = 2"] },
]

describe("a file whose name is not plain ASCII", () => {
  it("is in the review like any other", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    await driver.screen.open({ width: 140, height: 26, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("of 2")
    expect(frame).toContain("résumé.ts")
  })

  it("is reported by the command surface too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    const result = await driver.app.run([
      "branch",
      "list",
      "--repo",
      driver.repoPath,
      "--fields",
      "branch,files",
    ])

    // ASSERT
    const listed = JSON.parse(result.stdout) as { branches: ReadonlyArray<{ files: number }> }
    expect(listed.branches.find(() => true)?.files).toBe(2)
    expect(branch.name.length).toBeGreaterThan(0)
  })
})
