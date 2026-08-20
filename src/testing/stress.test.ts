import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lines = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `  const layer${index} = ${mark}(${index})`)

const hugeFile = {
  files: [
    {
      path: "src/jobs/scheduler.ts",
      before: ["export function scheduler() {", ...lines(220, "settle"), "}"],
      after: ["export function scheduler() {", ...lines(240, "resolve"), "}"],
    },
  ],
}

const manyFiles = {
  files: Array.from({ length: 20 }, (_, index) => ({
    path: `src/area${index % 4}/kind${index % 3}/file${index}.ts`,
    before: ["export const before = 1", ...lines(20, "settle")],
    after: ["export const after = 2", ...lines(24, "resolve")],
  })),
}

describe("a branch big enough to be real", () => {
  it("survives being read from top to bottom", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(hugeFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["G"])
    await driver.screen.pressKeys(["g"])
    await driver.screen.pressKeys(["}", "{"])

    // ASSERT
    expect(driver.screen.renderCrashes()).toEqual([])
    expect(await driver.screen.getFrame()).toContain("scheduler.ts")
  })

  it("survives every key on every file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(manyFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["G", "g", "}", "{", "h", "l", "TAB", "TAB", "m", "M"])
    await driver.screen.pressKeys(Array.from({ length: 20 }, () => "]"))
    await driver.screen.pressKeys(["G", "v", "j", "j"])

    // ASSERT
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  it("survives widening the context on a large file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(hugeFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.typeText("+")
    await driver.screen.pressKeys(["G"])
    await driver.screen.typeText("+")

    // ASSERT
    expect(driver.screen.renderCrashes()).toEqual([])
  })
})
