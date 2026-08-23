import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const five = [
  "const keep = 0",
  "const first = 1",
  "const second = 2",
  "const third = 3",
  "const fourth = 4",
]

const oneFile = {
  files: [{ path: "src/api.ts", before: ["const keep = 0"], after: five }],
}

const rowOf = (frame: string, text: string): number =>
  frame.split("\n").findIndex((row) => row.includes(text))

const twoComments = async (driver: TestDriver, width = 120) => {
  const branch = await driver.branch.create(oneFile)
  await driver.screen.open({ width, height: 24, review: true })
  await driver.screen.pressKeys(["j"])
  await driver.screen.writeComment("why first")
  await driver.screen.pressKeys(["j", "j"])
  await driver.screen.writeComment("why second")
  return branch
}

describe("when the agent adds lines above and between two commented lines", () => {
  test("then each comment shows under the code it was written against", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoComments(driver)

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", [
      "const added = 9",
      "const keep = 0",
      "const first = 1",
      "const between = 8",
      "const second = 2",
      "const third = 3",
      "const fourth = 4",
    ])
    await driver.branch.commitAll(branch, "lines above and between")
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowOf(frame, "why first")).toBe(rowOf(frame, "const first = 1") + 2)
    expect(rowOf(frame, "why second")).toBe(rowOf(frame, "const second = 2") + 2)
  })
})

describe("when the agent rewrites the line a comment was written against", () => {
  test("then the comment is not drawn against the line that took its place", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoComments(driver)

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", [
      "const added = 9",
      "const keep = 0",
      "const renamedFirst = 1",
      "const second = 2",
      "const third = 3",
      "const fourth = 4",
    ])
    await driver.branch.commitAll(branch, "a line rewritten")
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const keep = rows.findIndex((row) => row.includes("const keep = 0"))
    expect(rows[keep + 1]).not.toContain("why first")
    expect(rows[keep + 1]).toContain("const renamedFirst = 1")
  })

  test("then the review panel says the comment is not in the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoComments(driver, 160)

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", [
      "const keep = 0",
      "const renamedFirst = 1",
      "const second = 2",
      "const third = 3",
      "const fourth = 4",
    ])
    await driver.branch.commitAll(branch, "a line rewritten")
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowOf(frame, "why first")).toBe(rowOf(frame, "not in the diff") + 1)
  })
})
