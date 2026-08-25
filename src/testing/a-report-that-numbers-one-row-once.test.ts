import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const before = Array.from({ length: 30 }, (_, at) => `const keep${at + 1} = ${at + 1}`)

const after = [...before.slice(0, 5), "const first = 'one'", ...before.slice(5)]

const files = [{ path: "src/tall.ts", before, after }]

const rowSaid = (report: string): string =>
  report.split("\n").find((line) => line.startsWith("- file ")) ?? ""

const rowMarked = (report: string): string =>
  report.split("\n").find((line) => /^>\s+\d+ /.test(line)) ?? ""

describe("when a bug report names the row the cursor is on", () => {
  test("then the row it names is the row it marks in the code around the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j", "j"])

    // ACT
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("the row numbers disagree")
    await driver.screen.pressCtrl("s")
    const report = (await driver.agent.listReports())[0] ?? ""

    // ASSERT
    const named = /row (?<row>\d+)/.exec(rowSaid(report))?.groups?.["row"] ?? ""
    expect(named).not.toBe("")
    expect(rowMarked(report)).toContain(` ${named} `)
  })
})
