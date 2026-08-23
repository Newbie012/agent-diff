import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

describe("when the reviewer opens the branch list", () => {
  test("then the branch list heads its first column BRANCH", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    const frame = await driver.screen.getFrame()
    const heading = frame.split("\n").find((row) => row.includes("FILES")) ?? ""
    expect(heading).toContain("BRANCH")
  })

  test("then the line above the branch list counts one branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1 branch")
  })

  test("then the line above the branch list counts two branches", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.branch.create({ ...oneFile, name: "second-branch" })

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("2 branches")
  })

  test("then no line of the branch list says worktree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    expect((await driver.screen.getFrame()).toLowerCase()).not.toContain("worktree")
  })
})

describe("when the reviewer opens the key sheet over the branch list", () => {
  test("then no key on the sheet says worktree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    expect((await driver.screen.getFrame()).toLowerCase()).not.toContain("worktree")
  })
})
