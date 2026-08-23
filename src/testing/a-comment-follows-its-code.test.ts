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

describe("when the agent adds lines above a commented line", () => {
  test("then the comment shows under the same code after the branch is read again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", [
      "const keep = 0",
      "const added = 9",
      "const first = 1",
      "const second = 2",
    ])
    await driver.branch.commitAll(branch, "a line above")
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const lines = (await driver.screen.getFrame()).split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    const comment = lines.findIndex((line) => line.includes("why first"))
    expect(anchor).toBeGreaterThan(0)
    expect(comment).toBe(anchor + 2)
  })
})
