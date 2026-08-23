import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const rowWith = (frame: string, text: string): number =>
  frame.split("\n").findIndex((line) => line.includes(text))

describe("when the agent answers in more than one line", () => {
  test("then each line of the answer keeps its own row", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.agent.seedAnswered({
      worktree: branch.worktree,
      head: await driver.branch.getHead(branch),
      file: "src/api.ts",
      line: 2,
      comment: "does this hold",
      answer: "two things:\n- moved the check\n- kept the token",
    })

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    const lead = rowWith(frame, "two things:")
    expect(lead).toBeGreaterThan(0)
    expect(rowWith(frame, "- moved the check")).toBe(lead + 1)
    expect(rowWith(frame, "- kept the token")).toBe(lead + 2)
  })
})
