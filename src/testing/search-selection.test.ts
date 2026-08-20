import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const TERM = "seatsLeft"

const caller = ["import { seatsLeft } from './seats'", "export const invite = () => seatsLeft(1)"]

const changed = {
  files: [
    {
      path: "src/seats.ts",
      before: ["export const seatsLeft = (team: number) => team"],
      after: [
        "export const seatsLeft = (team: number) => team",
        "export const spent = (team: number) => seatsLeft(team)",
      ],
    },
    { path: "src/invite.ts", before: caller, after: caller },
  ],
}

const rowsWith = (frame: string, text: string): ReadonlyArray<string> =>
  frame.split("\n").filter((line) => line.includes(text))

describe("taking a selection somewhere", () => {
  it("says how many lines went to the clipboard", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v", "j"])

    // ACT
    await driver.screen.pressKeys(["y"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("2 lines copied")
  })

  it("clears the selection once it is copied", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v", "j"])

    // ACT
    await driver.screen.pressKeys(["y"])
    await driver.screen.waitForNoticeToClear("copied")

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("2 lines")
  })
})

describe("searching the branch for what is selected", () => {
  it("lists every place the selected text appears", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v"])

    // ACT
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText(TERM)
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("seatsLeft")
    expect(rowsWith(frame, "src/seats.ts")).not.toHaveLength(0)
    expect(rowsWith(frame, "src/invite.ts")).not.toHaveLength(0)
  })

  it("puts the files this branch changes above the ones it does not", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v"])

    // ACT
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText(TERM)
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const whole = (await driver.screen.getFrame()).split("\n")
    const from = whole.findIndex((line) => /\d+ places?/.test(line))
    const lines = whole.slice(from)
    const inDiff = lines.findIndex((line) => line.includes("src/seats.ts"))
    const outside = lines.findIndex((line) => line.includes("src/invite.ts"))
    expect(inDiff).toBeGreaterThan(0)
    expect(outside).toBeGreaterThan(inDiff)
  })

  it("shows the lines around the match without leaving the list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v"])
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText(TERM)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("export const invite")
  })

  it("opens the file the match sits in when the branch changes it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["v"])
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText(TERM)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/seats.ts")
  })

  it("says a match outside the diff has no file to open", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v"])
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText(TERM)
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["ARROW_DOWN", "ARROW_DOWN", "ARROW_DOWN", "ARROW_DOWN"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("not changed on this branch")
  })

  it("returns the reader to where they were reading", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(changed)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v"])
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText(TERM)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/seats.ts")
    expect(frame).not.toContain("places")
  })

  it("says so when nothing matches", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [{ path: "src/only.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
    })
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j", "v"])

    // ACT
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText("nowhereAtAllInThisRepo")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing uses")
  })
})
