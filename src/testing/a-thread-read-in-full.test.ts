import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const LONG_PATH = "apps/platform/src/pages/process-tree/parts/ExportControl/ExportControl.module.css"

const SAID =
  "this should be moved to a css variable so the drawing and the chip agree on one duration"

const kept = { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }

const chip = {
  path: LONG_PATH,
  before: [".chip {", "  color: red;", "}"],
  after: [".chip {", "  clip-path: inset(0 round 4px);", "}"],
}

const seed = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files: [kept, chip] })
  await driver.app.runComment({
    branch: branch.name,
    file: LONG_PATH,
    start: 2,
    end: 2,
    body: SAID,
  })
  await driver.branch.setFile(branch, LONG_PATH, [".chip {", "  color: red;", "}"])
  await driver.screen.open({ width: 150, height: 30, review: true })
  await driver.screen.pressKeys(["tab"])
  await driver.screen.pressKeys(["l"])
}

describe("when the review panel is too narrow for a whole thread", () => {
  test("then opening the thread reads its file and its words in full", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await seed(driver)
    expect(await driver.screen.getFrame()).not.toContain("css variable so the drawing")

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain(LONG_PATH)
    expect(frame).toContain("css variable so the drawing")
  })

  test("then closing it leaves the diff where it was", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await seed(driver)
    await driver.screen.pressKeys(["l"])

    // ACT
    await driver.screen.pressKeys(["escape"])
    await driver.screen.waited(300)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("css variable so the drawing")
    expect(frame).toContain("const b = 2")
  })
})
