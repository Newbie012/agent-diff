import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `const kept${index} = ${index}`)

const buried = (mark: string): ReadonlyArray<string> => [
  ...filler(24),
  `export const invite = () => ${mark}()`,
  "const tail = 1",
]

const branch = {
  files: [{ path: "src/invitations.ts", before: buried("settle"), after: buried("resolve") }],
}

describe("when a selection reaches over a row of hidden lines", () => {
  test("then adiff names the lines the comment will land on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 32, review: true })
    await driver.screen.pressKeys(["k"])
    await driver.screen.pressKeys(["v", "j", "j", "j"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/invitations.ts:22-24")
  })

  test("then the quote carries code rather than the hidden-lines row", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 32, review: true })
    await driver.screen.pressKeys(["k"])
    await driver.screen.pressKeys(["v", "j", "j", "j"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const panel = (await driver.screen.getFrame())
      .split("\n")
      .filter((line) => line.includes("┃"))
    expect(panel.some((line) => line.includes("lines hidden"))).toBe(false)
    expect(panel.some((line) => line.includes("const kept21"))).toBe(true)
  })

  test("then the count is of lines held, not rows covered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 32, review: true })
    await driver.screen.pressKeys(["k"])

    // ACT
    await driver.screen.pressKeys(["v", "j", "j", "j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/invitations.ts  3 lines")
  })
})
