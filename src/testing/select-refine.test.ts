import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const before = [
  "const head = 0",
  "const one = 1",
  "const two = 2",
  "const tail = 0",
  "const three = 3",
  "const last = 0",
]

const after = [
  "const head = 0",
  "const one = 11",
  "const two = 22",
  "const tail = 0",
  "const three = 33",
  "const last = 0",
]

const file = { files: [{ path: "src/api.ts", before, after }] }

const open = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(file)
  await driver.screen.open({ review: true })
}

describe("when a change is selected", () => {
  test("then the whole change under the cursor is taken", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["V"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/api.ts  4 lines")
  })

  test("then the footer reports the cursor is on an unchanged line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)

    // ACT
    await driver.screen.pressKeys(["V"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no change under the cursor")
  })

  test("then o grows the selection from the other end", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    await driver.screen.pressKeys(["j", "j"])
    await driver.screen.pressKeys(["v"])
    await driver.screen.pressKeys(["j"])
    expect(await driver.screen.getFrame()).toContain("src/api.ts  2 lines")

    // ACT
    await driver.screen.pressKeys(["o"])
    await driver.screen.pressKeys(["k"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/api.ts  3 lines")
  })

  test("then a comment anchors to the change that was selected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(file)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["V"])

    // ACT
    await driver.screen.writeComment("these two belong together")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.start).toBe(2)
    expect(comments[0]?.end).toBe(3)
  })
})
