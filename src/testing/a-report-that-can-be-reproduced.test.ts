import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const before = Array.from({ length: 30 }, (_, at) => `const keep${at + 1} = ${at + 1}`)

const after = [...before.slice(0, 5), "const first = 'one'", ...before.slice(5, 20), "const second = 'two'", ...before.slice(20)]

const oneFile = { files: [{ path: "src/tall.ts", before, after }] }

const twoLayers = {
  summary: "Two layers over one file",
  layers: [
    { title: "The first change", spans: [{ path: "src/tall.ts", start: 6, end: 6 }] },
    { title: "The second change", spans: [{ path: "src/tall.ts", start: 22, end: 22 }] },
  ],
}

const reported = async (driver: TestDriver): Promise<string> => {
  await driver.screen.pressCtrl("b")
  await driver.screen.typeText("the layers read oddly")
  await driver.screen.pressCtrl("s")
  const reports = await driver.agent.listReports()
  return reports[0] ?? ""
}

describe("when a reviewer reports a bug from a branch with a reading order", () => {
  test("then the report says what the reading order holds", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    const report = await reported(driver)

    // ASSERT
    expect(report).toContain("reading order: 2 layers over 2 spans")
    expect(report).toContain("rail on layers")
    expect(report).toContain("standing on `The first change`")
  })

  test("then the report says which preferences are away from their default", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["w"])

    // ACT
    const report = await reported(driver)

    // ASSERT
    expect(report).toContain("preferences away from default: wrap")
  })

  test("then the report says the base it compared against and the shape of the file on screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    const report = await reported(driver)

    // ASSERT
    expect(report).toContain("base `resolved by adiff`")
    expect(report).toContain("2 hunks shown, 3 lines of context")
  })

  test("then the report says the pull request's remarks are off", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    const report = await reported(driver)

    // ASSERT
    expect(report).toContain("the pull request's remarks are off")
  })
})

describe("when the reviewer sends a minimal report from a branch with a reading order", () => {
  test("then the shape of the reading order is said and the layer's words are not", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("the layers read oddly")

    // ACT
    await driver.screen.pressCtrl("t")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const report = (await driver.agent.listReports())[0] ?? ""
    expect(report).toContain("reading order: 2 layers over 2 spans")
    expect(report).toContain("standing on layer 1")
    expect(report).not.toContain("The first change")
  })
})
