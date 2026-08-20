import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

const drawn = (frame: string): number =>
  frame.split("\n").filter((line) => line.trim().length > 0).length

describe("when the terminal changes size", () => {
  test("then adiff keeps drawing after the terminal shrinks", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 160, height: 40, review: true })

    // ACT
    await driver.screen.resize(80, 24)
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(drawn(frame)).toBeGreaterThan(3)
    expect(frame).toContain("src/")
  })

  test("then adiff survives being squeezed very small and opened out again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 160, height: 40, review: true })

    // ACT
    const stepped = async (width: number, height: number): Promise<void> => {
      await driver.screen.resize(width, height)
      await driver.screen.pressKeys(["j"])
    }
    await stepped(60, 18)
    await stepped(40, 12)
    await stepped(200, 50)
    await stepped(100, 30)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(drawn(frame)).toBeGreaterThan(3)
    expect(frame).toContain("src/")
  })

  test("then adiff comes back from a terminal too narrow to draw in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 140, height: 30, review: true })

    // ACT
    await driver.screen.resize(10, 20)
    await driver.screen.resize(140, 30)
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(drawn(frame)).toBeGreaterThan(3)
    expect(frame).toContain("src/")
  })

  test("then adiff says the terminal is too narrow", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 140, height: 30, review: true })

    // ACT
    await driver.screen.resize(16, 20)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("more room")
  })

  test("then adiff keeps drawing after the terminal grows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 80, height: 24, review: true })

    // ACT
    await driver.screen.resize(160, 40)
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(drawn(frame)).toBeGreaterThan(3)
    expect(frame).toContain("src/")
  })
})
