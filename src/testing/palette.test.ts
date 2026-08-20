import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.tsx", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

describe("when a command is found without knowing its key", () => {
  test("then the palette lists the commands available on this screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("comment")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Commands")
    expect(frame).toContain("Comment on the selection")
    expect(frame).toContain("Next comment")
    expect(frame).toContain("Previous comment")
  })

  test("then the chosen command runs", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("next file")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/ui.tsx")
    expect(frame).toContain("file 2 of 2")
  })

  test("then dismissing the palette leaves the review untouched", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    await driver.screen.pressCtrl("p")
    expect(await driver.screen.getFrame()).toContain("Go to last line")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Go to last line")
    expect(frame).toContain("src/api.ts")
    expect(frame).toContain("file 1 of 2")
  })
})

describe("when a command's name is long", () => {
  test("then a gap stays between the name and its category", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("close")

    // ASSERT
    const row = (await driver.screen.getFrame())
      .split("\n")
      .find((line) => line.includes("Close the folder")) ?? ""
    expect(row).toContain("Files")
    expect(row).not.toMatch(/\S(Files|Review|General|Branches)/)
  })
})
