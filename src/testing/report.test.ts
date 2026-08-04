import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

describe("reporting a bug from inside the terminal", () => {
  it("writes down what the reviewer said", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN", "j"])
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("the cursor jumps two lines when I press j")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    const reports = await driver.agent.listReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toContain("the cursor jumps two lines when I press j")
  })

  it("attaches what was happening, so it can be reproduced", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN", "j", "v"])
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("selection looks wrong")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    const report = (await driver.agent.listReports())[0] ?? ""
    expect(report).toContain(branch.name)
    expect(report).toContain("src/api.ts")
    expect(report).toContain("select.start")
    expect(report).toContain("const first = 1")
  })

  it("refuses a report with nothing in it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressCtrl("b")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(await driver.agent.listReports()).toHaveLength(0)
  })

  it("writes nothing when the report is abandoned", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("never mind")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    expect(await driver.agent.listReports()).toHaveLength(0)
  })
})
