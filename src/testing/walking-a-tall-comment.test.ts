import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 30 }, (_, at) => `const line${at} = ${at};`)

const essay = Array.from(
  { length: 40 },
  (_, at) => `Paragraph ${at} of an answer that wraps across the pane and keeps going for a while yet.`,
).join(" ")

const open = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({
    files: [{ path: "src/small.ts", before: [], after: body }],
  })
  await driver.app.runComment({
    branch: branch.name,
    file: "src/small.ts",
    start: 5,
    end: 5,
    body: essay,
  })
  await driver.screen.open({ width: 100, height: 24, review: true })
}

describe("a comment taller than the pane", () => {
  it("is read a page at a time rather than skipped", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    await driver.screen.pressKeys(["j", "j", "j", "j", "j", "j"])
    expect(await driver.screen.getFrame()).toContain("Paragraph 0 ")

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Paragraph 0 ")
    expect(frame).not.toContain("const line5")
    expect(frame).toContain("Paragraph")
  })

  it("carries on to the line below once it has been read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    await driver.screen.pressKeys(Array.from({ length: 6 }, () => "j"))

    // ACT
    await driver.screen.pressKeys(Array.from({ length: 12 }, () => "j"))

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("const line6")
  })
})
