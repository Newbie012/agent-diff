import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const kept = Array.from({ length: 20 }, (_, index) => `    const kept${index} = ${index}`)

const body = (mark: string): ReadonlyArray<string> =>
  Array.from({ length: 40 }, (_, index) => `    layer${index}("${mark}")`)

const nested = (mark: string): ReadonlyArray<string> => [
  "export function outer(input: string) {",
  "  if (ready(input)) {",
  ...kept,
  ...body(mark),
  "  }",
  "}",
]

const deep = { files: [{ path: "src/deep.ts", before: nested("before"), after: nested("after") }] }

const pinned = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => line.slice(36).trim())
    .filter((line) => /^(export function outer|if \(ready)/.test(line))

describe("when the enclosing scope is kept on screen", () => {
  test("then the whole chain pins once the reviewer is inside it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    const shown = pinned(await driver.screen.getFrame())
    expect(shown).toHaveLength(2)
    expect(shown[0]).toContain("export function outer")
    expect(shown[1]).toContain("if (ready")
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  test("then nothing pins with the first line of the file on screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [
        {
          path: "src/top.ts",
          before: ["export function outer(input: string) {", "  if (ready(input)) {", "  }", "}"],
          after: [
            "export function outer(input: string) {",
            "  if (ready(input)) {",
            "    added()",
            "  }",
            "}",
          ],
        },
      ],
    })
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(pinned(await driver.screen.getFrame())).toHaveLength(0)
  })
})

describe("when the pinned line is drawn", () => {
  test("then the pinned line is highlighted the way the diff is", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    const keyword = await driver.screen.findForeground("#bb9af7")
    const pinnedRow = keyword.find((line) => line.includes("export function outer"))
    expect(pinnedRow).toBeDefined()
  })
})
