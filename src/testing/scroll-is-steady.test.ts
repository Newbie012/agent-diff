import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const deep = Array.from({ length: 60 }, (_, at) =>
  at % 6 === 0
    ? `export const outer${at} = () => {`
    : at % 6 === 5
      ? "};"
      : `${"  ".repeat((at % 6) + 1)}const inner${at} = ${at};`,
)

const indented = {
  files: [
    {
      path: "src/deep.ts",
      before: deep,
      after: [...deep, "const tail = 1;"],
    },
  ],
}

const diffRows = (frame: string): ReadonlyArray<string> => {
  const lines = frame.split("\n")
  const top = lines.findIndex((line) => line.includes("╭"))
  const bottom = lines.findIndex((line) => line.includes("╰"))
  return lines
    .slice(top + 1, bottom === -1 ? undefined : bottom)
    .map((line) => line.slice(33))
    .filter((line) => line.trim().length > 0)
}

describe("when a scope is pinned above the diff", () => {
  test("then the pin names the scope the hunk sits in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(indented)

    // ACT
    await driver.screen.open({ width: 100, height: 16, review: true })
    await driver.screen.pressKeys(["k"])

    // ASSERT
    expect(diffRows(await driver.screen.getFrame())[0]).toContain("export const outer")
  })

  test("then the pin lets go at the top of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(indented)
    await driver.screen.open({ width: 100, height: 16, review: true })
    await driver.screen.pressKeys(["k"])

    // ACT
    await driver.screen.pressKeys(["F"])

    // ASSERT
    expect(diffRows(await driver.screen.getFrame())[0]).toContain("outer0")
  })
})
