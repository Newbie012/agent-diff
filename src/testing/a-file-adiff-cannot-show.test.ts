import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when a binary file is opened", () => {
  test("then the diff marks the file as binary", async () => {
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

describe("when a file has no newline at the end", () => {
  test("then the diff marks the missing newline", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [{ path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
    })
    await driver.branch.setRaw(branch, "src/tail.ts", "const tail = 1")
    await driver.branch.commitAll(branch, "add a file with no trailing newline")
    await driver.branch.setRaw(branch, "src/tail.ts", "const tail = 2")
    await driver.branch.commitAll(branch, "change it, still no trailing newline")

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })
    await driver.screen.pressKeys(["]"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no newline at end of file")
  })
})
