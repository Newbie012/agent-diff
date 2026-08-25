import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/api.ts",
    before: ["const keep = 0"],
    after: ["const keep = 0", "const first = 1"],
  },
]

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const rowWith = (frame: string, text: string): string =>
  rowsOf(frame).find((row) => row.includes(text)) ?? ""

describe("when a line carries a thread the agent has answered", () => {
  test("then the reviewer's own words are marked as theirs, beside the agent's answer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j", "c"])
    await driver.screen.typeText("why is this one first")
    await driver.screen.pressCtrl("s")
    const listed = await driver.app.runThreads(branch.name)
    const id = (listed.envelope as { comments: ReadonlyArray<{ id: string }> }).comments[0]?.id ?? ""
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id,
      body: "because the order is the point",
    })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "why is this one first")).toMatch(/»\s+why is this one first/)
    expect(rowWith(frame, "because the order is the point")).toContain("↳")
  })
})

describe("when one line carries two threads", () => {
  test("then a rule separates the second from the first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j", "c"])
    await driver.screen.typeText("the first thing")
    await driver.screen.pressCtrl("s")
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("the second thing")
    await driver.screen.pressCtrl("s")

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const rows = rowsOf(await driver.screen.getFrame())
    const first = rows.findIndex((row) => row.includes("» the first thing"))
    const second = rows.findIndex((row) => row.includes("» the second thing"))
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first + 1)
    const between = rows.slice(first + 1, second).map((row) => row.slice(52, 104))
    expect(between.some((row) => row.replace(/[│┃|]/g, "").trim().length === 0)).toBe(true)
  })
})
