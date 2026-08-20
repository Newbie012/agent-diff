import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const many = {
  files: Array.from({ length: 30 }, (_, index) => ({
    path: `src/area${index % 5}/file${index}.ts`,
    before: [`const before${index} = 1`],
    after: [`const before${index} = 1`, `const after${index} = 2`],
  })),
}

const LIST_EDGE = 38

const pane = (frame: string): string =>
  frame
    .split("\n")
    .slice(2)
    .map((line) => line.slice(0, LIST_EDGE))
    .join("\n")

const headerOf = (frame: string): string =>
  frame.split("\n").find((line) => line.trim().length > 0)?.trim() ?? ""

describe("when a branch touches many files", () => {
  test("then the current file stays visible in the list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(many)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(Array.from({ length: 25 }, () => "]"))

    // ASSERT
    const frame = await driver.screen.getFrame()
    const current = headerOf(frame).split("  ")[1] ?? ""
    const name = current.split("/").at(-1) ?? ""
    expect(name.length).toBeGreaterThan(0)
    expect(pane(frame)).toContain(name.replace(".ts", ""))
  })

  test("then adiff says how many files the branch touches", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(many)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("file 1 of 30")
  })
})
