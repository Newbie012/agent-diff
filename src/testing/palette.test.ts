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
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

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
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("next file")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/ui.tsx")
    expect(frame).toContain("2/2")
  })

  it("leaves the review untouched when the palette is dismissed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    await driver.screen.pressCtrl("p")
    expect(await driver.screen.getFrame()).toContain("Go to last line")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Go to last line")
    expect(frame).toContain("src/api.ts")
    expect(frame).toContain("1/2")
  })
})
