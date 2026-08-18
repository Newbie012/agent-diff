import { describe, expect, it } from "@effect/vitest"
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

const say = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText(body)
  await driver.screen.pressCtrl("s")
}

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

describe("comments in the diff", () => {
  it("shows a comment under the line it was written against", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await say(driver, "why first")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const lines = frame.split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    const comment = lines.findIndex((line) => line.includes("why first"))
    expect(anchor).toBeGreaterThan(0)
    expect(lines[anchor + 1]).toContain("sent")
    expect(comment).toBe(anchor + 2)
  })

  it("leaves the comment row out of the line numbers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await say(driver, "why first")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "why first")).not.toMatch(/│[▎●\s]*\d/)
  })

  it("stops once on the comment, then carries on to the next line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await say(driver, "why first")

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

describe("how a comment row reads", () => {
  it("draws the comment in one colour, not as code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await say(driver, "const parsed = 1")

    // ASSERT
    const painted = await driver.screen.listForegroundsOn("const parsed = 1")
    expect(painted).toHaveLength(1)
  })
})

const stageEvery = async (driver: TestDriver, layers: ReadonlyArray<number>): Promise<void> => {
  const [layer, ...rest] = layers
  if (layer === undefined) return
  await driver.screen.pressKeys(["j"])
  await say(driver, `note ${layer} spelled out over a whole line of talking`)
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

describe("reading a diff full of comments", () => {
  it("keeps the cursor on screen once comments take up room", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(many)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stageEvery(driver, [1, 2, 3, 4, 5])

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "const layer29 = 29")).toContain("▎")
  })
})
