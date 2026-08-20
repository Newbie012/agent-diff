import { describe, expect, test } from "@effect/vitest"
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

describe("when a bug is reported from inside the terminal", () => {
  test("then the report carries what the reviewer said", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("the cursor jumps two lines when I press j")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    const reports = await driver.agent.listReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toContain("the cursor jumps two lines when I press j")
  })

  test("then the report attaches what was happening", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j", "v"])
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

  test("then adiff refuses a report with nothing in it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressCtrl("b")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(await driver.agent.listReports()).toHaveLength(0)
  })

  test("then an abandoned report writes nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("never mind")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    expect(await driver.agent.listReports()).toHaveLength(0)
  })
})
