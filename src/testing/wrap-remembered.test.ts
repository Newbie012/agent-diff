import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const long =
  "  const message = `a team invitation for ${email} could not be sent because the seat count for ${team} is already spent`"

const wide = {
  files: [
    {
      path: "src/api.ts",
      before: ["const kept = 1", "}"],
      after: ["const kept = 1", long, "}"],
    },
  ],
}

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const runOn = (frame: string): boolean =>
  rowsOf(frame).some((row) => row.includes("spent`") && !row.includes("const message"))

describe("when a reader's wrapping preference is kept", () => {
  test("then the diff wraps again the next time the terminal opens", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })
    await driver.screen.pressKeys(["w"])
    expect(runOn(await driver.screen.getFrame())).toBe(true)

    // ACT
    await driver.screen.restart({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(runOn(await driver.screen.getFrame())).toBe(true)
  })

  test("then wrapping stays off for a reader who never asked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)

    // ACT
    await driver.screen.open({ width: 72, review: true })

    // ASSERT
    expect(runOn(await driver.screen.getFrame())).toBe(false)
  })

  test("then wrapping is forgotten once the reader turns it off", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open({ width: 72, review: true })
    await driver.screen.pressKeys(["w"])
    await driver.screen.pressKeys(["w"])

    // ACT
    await driver.screen.restart({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(runOn(await driver.screen.getFrame())).toBe(false)
  })
})
