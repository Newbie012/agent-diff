import { describe, expect, it } from "@effect/vitest"
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
  await driver.screen.open()
  await driver.screen.pressKeys(["RETURN"])
}

describe("selecting a change", () => {
  it("takes the whole change under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["V"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/api.ts  4 lines")
  })

  it("says so when the cursor sits on an unchanged line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)

    // ACT
    await driver.screen.pressKeys(["V"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no change under the cursor")
  })

  it("grows from the other end after o", async () => {
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

  it("anchors a comment to the change it selected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(file)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["V"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("these two belong together")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.start).toBe(2)
    expect(comments[0]?.end).toBe(3)
  })
})
