import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const cursorRow = (frame: string): string =>
  frame.split("\n").find((row) => row.includes("▎")) ?? ""

describe("reaching the ends of the worktree list", () => {
  it("goes to the last worktree and back to the first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      name: "add-invitations",
      files: [{ path: "src/a.ts", before: ["a"], after: ["a", "b"] }],
    })
    await driver.branch.create({
      name: "retry-webhooks",
      files: [{ path: "src/b.ts", before: ["a"], after: ["a", "b"] }],
    })
    await driver.branch.create({
      name: "tidy-the-client",
      files: [{ path: "src/c.ts", before: ["a"], after: ["a", "b"] }],
    })
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(cursorRow(await driver.screen.getFrame())).toContain("tidy-the-client")

    // ACT
    await driver.screen.pressKeys(["g"])

    // ASSERT
    expect(cursorRow(await driver.screen.getFrame())).toContain("add-invitations")
  })
})
