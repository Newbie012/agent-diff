import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const five = ["const keep = 0", "const first = 1", "const second = 2", "const third = 3", "const fourth = 4"]

const renamed = ["const keep = 0", "const renamedFirst = 1", "const second = 2", "const third = 3", "const fourth = 4"]

const files = [{ path: "src/api.ts", before: ["const keep = 0"], after: five }]

const movedPast = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.screen.open({ width: 150, height: 30, review: true })
  await driver.screen.pressKeys(["j", "j"])
  await driver.screen.writeComment("why second")
  await driver.screen.pressKeys(["k"])
  await driver.screen.writeComment("why first")
  await driver.branch.changeAndCommit(branch, "src/api.ts", renamed, "rename first")
  await driver.screen.pressKeys(["r"])
}

describe("when the reviewer opens a comment the branch moved past whose line number is still in the diff", () => {
  test("then the thread screen shows the comment and the code it was written on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await movedPast(driver)
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["j", "l"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the diff no longer has that line")
    expect(frame).toContain("why first")
    expect(frame).toContain("const first = 1")
  })
})

describe("when the reviewer marks a file whose open threads include one the branch moved past", () => {
  test("then the box lists each thread and says which one is not in the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await movedPast(driver)

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api.ts still holds 2 open threads")
    expect(frame).toContain("why first · not in the diff")
    expect(frame).toContain("why second · line 3")
    expect(frame).toContain("Settle them and mark the file read")
  })
})
