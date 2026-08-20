import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.tsx", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

describe("finding a command without knowing its key", () => {
  it("lists the commands available on the current screen", async () => {
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

  it("runs the command that was chosen, so the key never had to be learned", async () => {
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

  it("leaves the review untouched when the palette is dismissed", async () => {
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

describe("a command whose name is long", () => {
  it("keeps a gap between the name and its category", async () => {
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
