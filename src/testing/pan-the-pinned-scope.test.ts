import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const scope =
  "export function issueInvitation(team: string, email: string, role: MemberRole, expiresAt: Date) {"

const body = (mark: string): ReadonlyArray<string> => [
  scope,
  "  if (ready(team)) {",
  ...Array.from({ length: 30 }, (_, index) => `    kept${index}()`),
  `    step("${mark}")`,
  ...Array.from({ length: 30 }, (_, index) => `    rest${index}()`),
  "  }",
  "}",
]

const narrow = {
  files: [{ path: "src/invite.ts", before: body("before"), after: body("after") }],
}

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const pinnedRow = (frame: string): string =>
  rowsOf(frame).find((row) => row.includes("issueInvitation")) ?? ""

describe("when a pinned scope is wider than the pane", () => {
  test("then the pinned line pans even where the code below is narrow", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(narrow)
    await driver.screen.open({ width: 100, review: true })
    await driver.screen.pressKeys(["j", "j", "j"])
    const before = await driver.screen.getFrame()
    expect(pinnedRow(before)).toContain("issueInvitation")
    expect(before).not.toContain("expiresAt")

    // ACT
    await driver.screen.pressKeys([">", ">", ">", ">", ">", ">"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("expiresAt")
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  test("then panning stops once nothing is left to reveal", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(narrow)
    await driver.screen.open({ width: 100, review: true })
    await driver.screen.pressKeys(["j", "j", "j"])

    // ACT
    await driver.screen.pressKeys(Array.from({ length: 30 }, () => ">"))

    // ASSERT
    const header = (await driver.screen.rows()).find((row) => row.trim().length > 0) ?? ""
    const reported = Number(/→ (\d+) columns/.exec(header)?.[1] ?? "0")
    expect(reported).toBeGreaterThan(0)
    expect(reported).toBeLessThan(scope.length)
  })
})

describe("when wrapping or a wide terminal changes the pinned scope", () => {
  test("then wrapping leaves the pinned line alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(narrow)
    await driver.screen.open({ width: 100, review: true })
    await driver.screen.pressKeys(["j", "j", "j", "w"])

    // ACT
    await driver.screen.pressKeys([">", ">", ">"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("wrapping is on")
    expect(pinnedRow(frame)).toContain("issueInvitation")
  })

  test("then eighty columns reveal the pinned line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(narrow)
    await driver.screen.open({ width: 80, review: true })
    await driver.screen.pressKeys(["j", "j", "j"])

    // ACT
    await driver.screen.pressKeys(Array.from({ length: 10 }, () => ">"))

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Date) {")
    expect(driver.screen.renderCrashes()).toEqual([])
  })
})
