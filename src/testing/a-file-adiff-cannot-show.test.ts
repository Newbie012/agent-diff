import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("a file adiff cannot show", () => {
  it("says a binary file is binary instead of drawing nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [{ path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
    })
    await driver.branch.setBinary(branch, "assets/blob.bin", 512)
    await driver.branch.commitAll(branch, "add a binary file")

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })
    await driver.screen.pressKeys(["["])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("binary file")
  })
})
