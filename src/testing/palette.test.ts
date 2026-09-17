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

describe("when the cursor is moved down before return", () => {
  test("then the command under the cursor runs, not the first match", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2", "const c = 3", "const d = 4"] }],
    })
    await driver.screen.open({ review: true })
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("line")
    await driver.screen.pressKeys(["ARROW_DOWN", "ARROW_DOWN", "ARROW_DOWN"])
    expect(await driver.screen.getFrame()).toMatch(/▎ G end\s+Go to last line/)

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Commands")
    expect(frame).toMatch(/▎\s+4 \+ const d = 4/)
  })
})

describe("when a command's name is long", () => {
  test("then the command keeps its whole name under its category's headline", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("close")

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const found = rows.findIndex((line) => line.includes("Close the folder"))
    expect(found).toBeGreaterThan(0)
    const heading = rows.findIndex((line) => line.includes("Commands"))
    expect(rows.slice(heading, found).some((line) => /\bFiles\b/.test(line))).toBe(true)
  })
})
