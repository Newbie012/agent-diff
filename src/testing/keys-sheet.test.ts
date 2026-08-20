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

describe("the keys a reviewer is shown", () => {
  it("carries the few a pass through a review is made of", async () => {
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

  it("fits the row it is drawn on", async () => {
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

describe("the sheet of every key", () => {
  it("lists what the screen answers to, with the key beside each", async () => {
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

  it("names the way out, which the palette leaves out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Go back")
  })

  it("closes on escape and leaves the diff where it was", async () => {
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

  it("runs the command under the cursor", async () => {
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

  it("stays out of the way where typing is the point", async () => {
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

describe("finding a command by typing", () => {
  it("names the key that runs it", async () => {
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
