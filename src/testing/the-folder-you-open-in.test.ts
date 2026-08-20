import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const held = 0"],
  after: ["const held = 0", "const one = 1"],
})

const inFolder = (dir: number): ReadonlyArray<ReturnType<typeof change>> =>
  Array.from({ length: 9 }, (_, at) => change(`mod${dir}/unit${dir}${at}.ts`))

const files = [0, 1, 2, 3, 4].flatMap((dir) => inFolder(dir))

const railOf = (frame: string): string =>
  frame
    .split("\n")
    .map((line) => line.split("│")[1] ?? "")
    .join("\n")

describe("when the review opens inside a folder", () => {
  test("then the folder is open and the current file is visible", async () => {
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
