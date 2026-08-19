import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/one.ts",
    before: ["const a = 1"],
    after: ["const a = 1", "const one = 2", "const two = 3", "const three = 4"],
  },
]

const threads = async (driver: TestDriver): Promise<string> => {
  const branch = await driver.branch.create({ files })
  const points = [
    { line: 2, body: "the first point" },
    { line: 3, body: "the second point" },
    { line: 4, body: "the third point" },
  ]
  await points.reduce<Promise<unknown>>(
    (waiting, point) =>
      waiting.then(() =>
        driver.app.runComment({
          branch: branch.name,
          file: "src/one.ts",
          start: point.line,
          end: point.line,
          body: point.body,
        }),
      ),
    Promise.resolve(),
  )
  return branch.name
}

const focusedThread = (frame: string): string => {
  const rows = frame.split("\n")
  const at = rows.findIndex((row) => /[▸·]/.test(row.slice(95)))
  return at === -1 ? "" : (rows[at + 1] ?? "").slice(95).trim()
}

const panelFocused = async (driver: TestDriver): Promise<void> => {
  await driver.screen.pressKeys(["TAB"])
}

describe("where the review panel leaves the cursor", () => {
  it("does not jump to the first thread when one is settled", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const name = await threads(driver)
    await driver.app.runConfigSet("hideSettled", true)
    await driver.screen.open({ width: 140, height: 26, branch: name })
    await panelFocused(driver)
    await driver.screen.pressKeys(["ARROW_DOWN"])
    expect(focusedThread(await driver.screen.getFrame())).toContain("the second point")

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(after).not.toContain("the second point")
    expect(focusedThread(after)).toContain("the first point")
  })

  it("keeps the settled thread under the cursor when settled threads are shown", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const name = await threads(driver)
    await driver.screen.open({ width: 140, height: 26, branch: name })
    await panelFocused(driver)
    await driver.screen.pressKeys(["ARROW_DOWN"])

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(focusedThread(await driver.screen.getFrame())).toContain("the second point")
  })
})
