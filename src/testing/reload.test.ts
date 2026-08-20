import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
    {
      path: "src/ui.tsx",
      before: ["const other = 0"],
      after: ["const other = 0", "const second = 2"],
    },
  ],
}

describe("when the agent works while the reviewer reads", () => {
  test("then the newest lines show without leaving the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    expect(await driver.screen.getFrame()).not.toContain("answered the comment")

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", [
      "const keep = 0",
      "const first = 1",
      "const answered = 'answered the comment'",
    ])
    await driver.branch.commitAll(branch, "agent: answer the comment")
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("answered the comment")
  })

  test("then the reader stays on the same file and line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["]"])
    const before = await driver.screen.getFrame()
    expect(before).toContain("src/ui.tsx  file 2 of 2")

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", [
      "const keep = 0",
      "const first = 1",
      "const extra = 3",
    ])
    await driver.branch.commitAll(branch, "agent: more work")
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/ui.tsx  file 2 of 2")
  })

  test("then the footer reports the branch was read again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("read the branch again")
  })
})
