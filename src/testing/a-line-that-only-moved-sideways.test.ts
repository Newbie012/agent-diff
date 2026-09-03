import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const wrapped = {
  files: [
    {
      path: "src/filters.ts",
      before: ["function apply(next) {", "  setPage(0)", "  setTitle(next.title)", "}"],
      after: [
        "function apply(next) {",
        "  startTransition(() => {",
        "    setPage(0)",
        "    setTitle(next.title)",
        "  })",
        "}",
      ],
    },
  ],
}

describe("when a block of lines is wrapped in a new function", () => {
  test("then the wrapper is washed as a change and the lines inside are washed dimmer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wrapped)

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    const added = await driver.screen.findHighlighted(palette.addedBg)
    expect(added.join(" ")).toContain("startTransition")
    expect(added.join(" ")).toContain("})")
    expect(added.join(" ")).not.toContain("setPage(0)")
    const removed = await driver.screen.findHighlighted(palette.removedBg)
    expect(removed.join(" ")).not.toContain("setPage(0)")
    const movedIn = await driver.screen.findHighlighted(palette.reindentAddedBg)
    expect(movedIn.join(" ")).toContain("setPage(0)")
    expect(movedIn.join(" ")).toContain("setTitle(next.title)")
    const movedOut = await driver.screen.findHighlighted(palette.reindentRemovedBg)
    expect(movedOut.join(" ")).toContain("setPage(0)")
  })
})

describe("when a line changes only in its trailing whitespace", () => {
  test("then the line keeps the full added and removed washes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [
        {
          path: "src/tail.ts",
          before: ["const kept = 1", "const tail = 2"],
          after: ["const kept = 1", "const tail = 2   "],
        },
      ],
    })

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    const added = await driver.screen.findHighlighted(palette.addedBg)
    expect(added.join(" ")).toContain("const tail = 2")
    const removed = await driver.screen.findHighlighted(palette.removedBg)
    expect(removed.join(" ")).toContain("const tail = 2")
  })
})
