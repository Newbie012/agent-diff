import { describe, expect, it } from "@effect/vitest"
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

describe("the pinned scope", () => {
  it("names the scope the hunk sits in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(indented)

    // ACT
    await driver.screen.open({ width: 100, height: 16 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(diffRows(await driver.screen.getFrame())[0]).toContain("export const outer")
  })

  it("lets go of it when the view reaches the top of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(indented)
    await driver.screen.open({ width: 100, height: 16 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["F"])

    // ASSERT
    expect(diffRows(await driver.screen.getFrame())[0]).toContain("outer0")
  })
})
