import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const HUMAN_MS = 150

const files = [
  {
    path: "src/seats.ts",
    before: ["export const seatsLeft = (team: number) => team"],
    after: [
      "export const seatsLeft = (team: number) => team",
      "export const spent = (team: number) => seatsLeft(team)",
    ],
  },
]

describe("when a reviewer types a name into the search box at their own pace", () => {
  test("then git is asked once, not once for every letter", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["/"])
    driver.screen.forgetGreps()

    // ACT
    const took = await driver.screen.typeSlowly("seatsLeft", HUMAN_MS)
    const found = await driver.screen.untilShown("in the worktree")

    // ASSERT
    expect(took).toBeGreaterThanOrEqual(HUMAN_MS * 8)
    expect(found).toBe(true)
    expect(driver.screen.grepsRun()).toBe(1)
    expect(await driver.screen.getFrame()).toContain("seatsLeft  ·")
  })

  test("then one letter is not searched for, and the box holds it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["/"])
    driver.screen.forgetGreps()

    // ACT
    await driver.screen.typeSlowly("s", HUMAN_MS)
    await driver.screen.waited(HUMAN_MS * 4)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(driver.screen.grepsRun()).toBe(0)
    expect(frame).toContain("Look for something")
    expect(frame.split("\n").some((row) => /^\s*│\s+s\s*│/.test(row) || row.includes(" s "))).toBe(
      true,
    )
  })

  test("then the places found are the places of the word the reviewer stopped on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true, slowFirstGrepMs: 1500 })
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.typeLoosely("seats", HUMAN_MS)
    await driver.screen.paused(HUMAN_MS * 3)
    await driver.screen.typeLoosely("Left", HUMAN_MS)
    await driver.screen.untilShown("seatsLeft  ·")
    await driver.screen.paused(HUMAN_MS * 14)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("seatsLeft  ·")
    expect(frame).not.toContain("seats  ·")
  })
})
