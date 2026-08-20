import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const held = 0"],
  after: ["const held = 0", "const one = 1"],
})

const files = Array.from({ length: 5 }, (_, dir) =>
  Array.from({ length: 9 }, (_, at) => change(`mod${dir}/unit${dir}${at}.ts`)),
).flat()

const railOf = (frame: string): string =>
  frame
    .split("\n")
    .map((line) => line.split("│")[1] ?? "")
    .join("\n")

describe("the folder the review opens in", () => {
  it("is open, so the file you are on is visible", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    const here = (frame.split("\n")[0] ?? "").split(/\s{2,}/)[2] ?? ""
    const leaf = here.split("/").at(-1) ?? ""
    expect(leaf).not.toBe("")
    expect(railOf(frame)).toContain(leaf)
  })
})
