import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const before = Array.from({ length: 40 }, (_, at) => `const keep${at + 1} = ${at + 1}`)

const after = [
  ...before.slice(0, 5),
  "const first = 'one'",
  ...before.slice(5, 20),
  "const second = 'two'",
  ...before.slice(20, 35),
  "const third = 'three'",
  ...before.slice(35),
]

const oneFile = {
  files: [{ path: "src/tall.ts", before, after }],
}

const threeLayers = {
  summary: "Three layers over one file",
  layers: [
    {
      title: "The first change",
      blocks: [
        { kind: "prose" as const, markdown: "This layer is about the first change alone." },
        { kind: "code" as const, path: "src/tall.ts", start: 6, end: 6 },
      ],
    },
    {
      title: "The second change",
      blocks: [
        { kind: "prose" as const, markdown: "This layer is about the second change alone." },
        { kind: "code" as const, path: "src/tall.ts", start: 22, end: 22 },
      ],
    },
    {
      title: "The third change",
      blocks: [
        { kind: "prose" as const, markdown: "This layer is about the third change alone." },
        { kind: "code" as const, path: "src/tall.ts", start: 38, end: 38 },
      ],
    },
  ],
}

const reading = async (driver: TestDriver) => {
  const branch = await driver.branch.create(oneFile)
  await driver.app.runLayersSet(branch.worktree, threeLayers)
  await driver.screen.open({ width: 150, height: 30, review: true })
}

describe("when three layers each claim one run of the same file", () => {
  test("then the first layer shows its own run and not the others", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await reading(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("const first = 'one'")
    expect(frame).not.toContain("const second = 'two'")
    expect(frame).not.toContain("const third = 'three'")
  })

  test("then a change another layer explains says which layer that is", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await reading(driver)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("layer 2 explains")
  })

  test("then the third layer shows the third change with the cursor on it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver)

    // ACT
    await driver.screen.pressKeys(["]", "]"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("const third = 'three'")
    expect(frame).not.toContain("const first = 'one'")
  })

  test("then the cursor stands on the line the layer claims", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver)

    // ACT
    await driver.screen.pressKeys(["]", "]"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const held = rows.find((row) => /▎\s+\d+\s+[+-]?\s*const/.test(row))
    expect(held).toContain("const third = 'three'")
  })

  test("then the layer's words sit above the run they introduce", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await reading(driver)

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const words = rows.findIndex((row) => row.includes("about the first change alone"))
    const code = rows.findIndex((row) => row.includes("const first = 'one'"))
    expect(words).toBeGreaterThan(0)
    expect(words).toBeLessThan(code)
  })
})

const CLOSE_BEFORE = Array.from({ length: 20 }, (_, at) => `const held${at + 1} = ${at + 1}`)

const CLOSE_AFTER = [
  ...CLOSE_BEFORE.slice(0, 5),
  "const mine = 'mine'",
  CLOSE_BEFORE[5] ?? "",
  "const yours = 'yours'",
  ...CLOSE_BEFORE.slice(6),
]

const shoulder = {
  files: [{ path: "src/close.ts", before: CLOSE_BEFORE, after: CLOSE_AFTER }],
}

const twoInOneHunk = {
  summary: "Two layers inside one hunk",
  layers: [
    {
      title: "Mine alone",
      blocks: [
        { kind: "prose" as const, markdown: "This layer claims one line of the hunk." },
        { kind: "code" as const, path: "src/close.ts", start: 6, end: 6 },
      ],
    },
    {
      title: "Yours alone",
      blocks: [
        { kind: "prose" as const, markdown: "This layer claims the other line." },
        { kind: "code" as const, path: "src/close.ts", start: 8, end: 8 },
      ],
    },
  ],
}

describe("when two layers claim different lines of one hunk", () => {
  test("then the first layer shows its own line and not the line the second claims", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(shoulder)
    await driver.app.runLayersSet(branch.worktree, twoInOneHunk)

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("const mine = 'mine'")
    expect(frame).not.toContain("const yours = 'yours'")
    expect(frame).toContain("layer 2 explains them")
  })
})
