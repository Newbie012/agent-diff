import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

const shown = (result: { readonly envelope: unknown }): ReadonlyArray<{ name: string; value: boolean }> =>
  (result.envelope as { preferences: ReadonlyArray<{ name: string; value: boolean }> }).preferences

const valueOf = (result: { readonly envelope: unknown }, name: string): boolean | undefined =>
  shown(result).find((one) => one.name === name)?.value

describe("the preferences adiff keeps", () => {
  it("start as what adiff did before there were any", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const listed = await driver.app.runConfigList()

    // ASSERT
    expect(valueOf(listed, "sticky")).toBe(true)
    expect(valueOf(listed, "hold")).toBe(false)
    expect(valueOf(listed, "wrap")).toBe(false)
  })

  it("keeps what the command line set", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.app.runConfigSet("hold", true)

    // ASSERT
    expect(valueOf(await driver.app.runConfigList(), "hold")).toBe(true)
  })

  it("refuses a name it does not know, and says which it does", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runConfigGet("stickyy")

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: false, error: { type: "UnknownPreference" } })
    expect(JSON.stringify(result.envelope)).toContain("sticky")
  })

  it("carries a toggle made in the review into the next session", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["S"])

    // ASSERT
    expect(valueOf(await driver.app.runConfigList(), "sticky")).toBe(false)
  })

  it("opens the next session the way the command line left it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.app.runConfigSet("wrap", true)

    // ACT
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect((await driver.screen.believes()).wrap).toBe(true)
  })
})
