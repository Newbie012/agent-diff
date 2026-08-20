import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const lines = (name: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `const ${name}${at} = ${at}`)

const grown = {
  files: [
    {
      path: "src/api.ts",
      before: lines("api", 2),
      after: [...lines("api", 2), ...lines("apiAdded", 8)],
    },
    {
      path: "src/model.ts",
      before: lines("model", 2),
      after: [...lines("model", 2), ...lines("modelAdded", 4)],
    },
  ],
}

const explained: LayersInput = {
  summary: "Invitations, end to end",
  layers: [
    {
      title: "Carry the team id through the queue",
      blocks: [
        { kind: "prose", markdown: "The queue dropped the team id on the floor." },
        { kind: "code", path: "src/api.ts", start: 3, end: 6 },
        { kind: "prose", markdown: "So the writer reads it back before it sends." },
        { kind: "code", path: "src/api.ts", start: 7, end: 10 },
      ],
    },
  ],
}

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const diffRow = (frame: string, text: string): number =>
  rowsOf(frame).findIndex((line) => line.includes(text))

describe("when a layer's prose is read beside its code", () => {
  test("then the prose sits above the code it introduces", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(grown)
    await driver.app.runLayersSet(branch.worktree, explained)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const prose = diffRow(frame, "dropped the team id")
    const code = diffRow(frame, "apiAdded0")
    expect(prose).toBeGreaterThan(0)
    expect(code).toBeGreaterThan(prose)
  })

  test("then the blocks show in the order the layer lists them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(grown)
    await driver.app.runLayersSet(branch.worktree, explained)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(diffRow(frame, "dropped the team id")).toBeLessThan(diffRow(frame, "reads it back"))
    expect(diffRow(frame, "reads it back")).toBeLessThan(diffRow(frame, "apiAdded4"))
  })

  test("then the prose carries no line numbers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(grown)
    await driver.app.runLayersSet(branch.worktree, explained)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const whole = rowsOf(frame).find((line) => line.includes("dropped the team id")) ?? ""
    const row = whole.slice(whole.indexOf("││"))
    expect(row).not.toMatch(/│[▎●\s]*\d/)
  })

  test("then a comment written below the prose anchors to its own line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(grown)
    await driver.app.runLayersSet(branch.worktree, explained)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["G"])
    await driver.screen.writeComment("why read it back here")

    // ASSERT
    const [comment] = await driver.agent.listComments(branch.worktree)
    expect(comment?.file).toBe("src/api.ts")
    expect(comment?.snippet).toContain("apiAdded")
    expect(await driver.screen.getFrame()).toContain("why read it back here")
  })

  test("then the plain file view carries no prose", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(grown)
    await driver.app.runLayersSet(branch.worktree, explained)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["s"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("dropped the team id")
  })
})
