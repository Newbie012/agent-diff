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

describe("when the footer shows a reviewer the keys", () => {
  test("then the footer carries the few keys a review is made of", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = await driver.screen.footer()
    expect(footer).toContain("] file")
    expect(footer).toContain("v select")
    expect(footer).toContain("c comment")
    expect(footer).toContain("? keys")
    expect(footer).not.toContain("wrap")
    expect(footer).not.toContain("reload")
    expect(footer).not.toContain("find")
  })

  test("then the footer fits the row it is drawn on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 80, height: 24 })

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = await driver.screen.footer()
    expect(footer).toContain("c comment")
    expect(footer).toContain("? keys")
    expect(footer.trimEnd().length).toBeLessThanOrEqual(80)
  })
})

describe("when the key sheet is open", () => {
  test("then the sheet lists what the screen answers to, with each key beside it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const row = (text: string): string =>
      frame.split("\n").find((line) => line.includes(text)) ?? ""
    expect(row("Find a command")).toContain("^p")
    expect(frame).toContain("Report a bug")
  })

  test("then the sheet names the way out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Go back")
  })

  test("then escape closes the sheet and leaves the diff where it was", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["?"])
    await driver.screen.typeText("wrap")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Wrap long lines")
    expect(frame).toContain("const first = 1")
  })

  test("then return runs the command under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["?"])
    await driver.screen.typeText("wrap")
    expect(await driver.screen.getFrame()).toContain("Wrap long lines")

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Wrap long lines")
  })

  test("then the sheet stays shut where typing is the point", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v", "c"])

    // ACT
    await driver.screen.typeText("why?")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why?")
    expect(frame).not.toContain("Wrap long lines")
  })
})

describe("when a command is found by typing", () => {
  test("then the match names the key that runs it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("wrap")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const row = frame.split("\n").find((line) => line.includes("Wrap long lines")) ?? ""
    expect(row).toContain("w")
    expect(row).toContain("Reading")
  })
})
