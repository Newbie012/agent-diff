import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

describe("when a comment sits in the diff", () => {
  test("then the comment shows under the line it was written against", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("why first")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const lines = frame.split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    const comment = lines.findIndex((line) => line.includes("why first"))
    expect(anchor).toBeGreaterThan(0)
    expect(lines[anchor + 1]).toContain("sent")
    expect(comment).toBe(anchor + 2)
  })

  test("then the comment row carries no line number", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("why first")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "why first")).not.toMatch(/│[▎●\s]*\d/)
  })

  test("then the cursor stops once on the comment before the next line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")

    // ACT
    await driver.screen.pressKeys(["j"])
    const onComment = await driver.screen.getFrame()
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(rowWith(onComment, "why first")).toContain("▎")
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "const second = 2")).toContain("▎")
    expect(rowWith(frame, "why first")).not.toContain("▎")
  })
})

describe("when a comment row is drawn", () => {
  test("then the comment draws in one colour", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("const parsed = 1")

    // ASSERT
    const painted = await driver.screen.listForegroundsOn("const parsed = 1")
    expect(painted).toHaveLength(1)
  })
})

const stageEvery = async (driver: TestDriver, layers: ReadonlyArray<number>): Promise<void> => {
  const [layer, ...rest] = layers
  if (layer === undefined) return
  await driver.screen.pressKeys(["j"])
  await driver.screen.writeComment(`note ${layer} spelled out over a whole line of talking`)
  await stageEvery(driver, rest)
}

const many = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", ...Array.from({ length: 30 }, (_, at) => `const layer${at} = ${at}`)],
    },
  ],
}

describe("when the diff is full of comments", () => {
  test("then the cursor stays on screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(many)
    await driver.screen.open({ review: true })
    await stageEvery(driver, [1, 2, 3, 4, 5])

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(await driver.screen.rowWith("const layer29 = 29")).toContain("▎")
  })
})
