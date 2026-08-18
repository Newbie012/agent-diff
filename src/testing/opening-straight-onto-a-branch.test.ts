import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const file = (mark: string) => ({
  path: `src/${mark}.ts`,
  before: ["const a = 1"],
  after: ["const a = 1", `const ${mark} = 2`],
})

describe("opening straight onto a branch", () => {
  it("draws its diff without waiting for the other worktrees", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "cdr-1-first", files: [file("one")] })
    const wanted = await driver.branch.create({ name: "cdr-2-second", files: [file("two")] })

    // ACT
    await driver.screen.open({ width: 120, height: 20, branch: wanted.name })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("cdr-2-second")
    expect(frame).toContain("const two = 2")
  })

  it("has the rest of them by the time the list is asked for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "cdr-1-first", files: [file("one")] })
    const wanted = await driver.branch.create({ name: "cdr-2-second", files: [file("two")] })
    await driver.screen.open({ width: 120, height: 20, branch: wanted.name })

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("cdr-1-first")
    expect(frame).toContain("cdr-2-second")
  })
})
