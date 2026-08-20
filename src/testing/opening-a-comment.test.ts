import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 150, height: 24 }

const long = Array.from({ length: 80 }, (_, at) => `const line${at} = ${at};`)

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/deep.ts", before: long, after: long.map((line, at) => (at === 59 ? "const line59 = 599;" : line)) },
  ],
}

describe("when a comment is opened from the review panel", () => {
  test("then the diff comes to the line the comment is on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/deep.ts",
      start: 60,
      end: 60,
      body: "look at this one",
    })
    await driver.screen.open({ ...WIDE, review: true })
    await driver.screen.pressKeys(["TAB"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("const line59")
    expect(frame).toContain("src/deep.ts")
  })
})
