import { describe, expect, it } from "@effect/vitest"
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

describe("a selection that reaches over a row of hidden lines", () => {
  it("names the lines it will actually comment on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 32 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["v", "j", "j", "j"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/invitations.ts:22-24")
  })

  it("quotes code, not the instruction on the row of hidden lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 32 })
    await driver.screen.pressKeys(["RETURN"])
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

  it("counts the lines it holds, not the rows it covers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(branch)
    await driver.screen.open({ width: 100, height: 32 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["v", "j", "j", "j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/invitations.ts  3 lines")
  })
})
