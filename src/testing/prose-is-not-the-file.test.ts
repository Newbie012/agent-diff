import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lines = (name: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `const ${name}${at} = ${at}`)

const files = [
  {
    path: "src/api.ts",
    before: lines("kept", 6),
    after: [...lines("kept", 6), ...lines("added", 4)],
  },
]

const RULE = "│"

const SAID = "The gate read one field while the items came from another"

const shown = async (driver: TestDriver): Promise<ReadonlyArray<string>> => {
  const branch = await driver.branch.create({ files })
  await driver.app.runLayersSet(branch.worktree, {
    summary: "One layer",
    layers: [
      {
        title: "The added lines",
        blocks: [
          { kind: "prose", markdown: `${SAID}, so the button could open an empty menu.` },
          { kind: "code", path: "src/api.ts", start: 7, end: 10 },
        ],
      },
    ],
  })
  await driver.screen.open({ width: 120, height: 26 })
  await driver.screen.pressKeys(["RETURN"])
  return (await driver.screen.getFrame()).split("\n")
}

describe("when a layer's prose sits beside the code", () => {
  test("then a rule runs down the prose's margin", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const rows = await shown(driver)

    // ASSERT
    const said = rows.find((row) => row.includes(SAID)) ?? ""
    expect(said).toContain(`${RULE} ${SAID}`)
  })

  test("then the rule stays on the wrapped lines and the blank that closes them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const rows = await shown(driver)

    // ASSERT
    const opens = rows.findIndex((row) => row.includes(SAID))
    const shuts = rows.findIndex((row, at) => at > opens && row.includes("const added0"))
    const between = rows.slice(opens, shuts)
    expect(between.length).toBeGreaterThan(1)
    expect(between.every((row) => row.includes(RULE))).toBe(true)
  })
})
