import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lines = (from: number, to: number): ReadonlyArray<string> =>
  Array.from({ length: to - from + 1 }, (_, at) => `  const step${from + at} = ${from + at}`)

const before = ["export const run = () => {", ...lines(2, 40), "}"]

const after = [
  "export const run = () => {",
  ...lines(2, 9),
  "  const one = 'first layer'",
  ...lines(11, 19),
  "  const two = 'second layer'",
  ...lines(21, 29),
  "  const three = 'third layer'",
  ...lines(31, 40),
  "}",
]

const files = [{ path: "src/run.ts", before, after }]

const threeLayers = {
  summary: "One file, three layers",
  layers: [
    { title: "The first change", spans: [{ path: "src/run.ts", start: 10, end: 10 }] },
    { title: "The second change", spans: [{ path: "src/run.ts", start: 20, end: 20 }] },
    { title: "The third change", spans: [{ path: "src/run.ts", start: 30, end: 30 }] },
  ],
}

const layered = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.app.runLayersSet(branch.worktree, threeLayers)
  await driver.screen.open({ width: 150, height: 30, review: true })
}

const railRows = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").map((row) => row.split("│")[1] ?? "")

const ticks = (frame: string): number => railRows(frame).filter((row) => row.includes("✓")).length

describe("when one file is spread over three layers", () => {
  test("then marking the first layer read leaves the other layers unread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const rows = railRows(await driver.screen.getFrame())
    expect(rows.filter((row) => row.includes("The first change") && row.includes("✓"))).toHaveLength(1)
    expect(rows.filter((row) => row.includes("The second change") && row.includes("✓"))).toHaveLength(0)
    expect(ticks(await driver.screen.getFrame())).toBe(2)
  })

  test("then the file counts as read once every layer of it is read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)

    // ACT
    await driver.screen.pressKeys(["m", "]", "m", "]", "m"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("1 reviewed")
    expect(ticks(frame)).toBe(6)
  })

  test("then the file is not read while one layer of it is unread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)

    // ACT
    await driver.screen.pressKeys(["m", "]", "m"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("1 reviewed")
  })
})
