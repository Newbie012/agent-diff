import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

const pane = (frame: string): string =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => line.slice(0, 32))
    .join("\n")

describe("when a file is marked reviewed from the terminal", () => {
  test("then the file under the cursor is marked and the tree says so", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("✓")
  })

  test("then the header counts the reviewed files", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1 reviewed")
  })

  test("then marking again takes the mark back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["m"])

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame.split("\n")[0]).not.toContain("reviewed")
  })

  test("then the mark survives leaving the branch and coming back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["m"])

    // ACT
    const report = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(report.envelope).toMatchObject({ ok: true, reviewed: ["src/api.ts"], total: 2 })
  })
})
