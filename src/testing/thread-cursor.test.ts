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

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

const sendComment = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText(body)
  await driver.screen.pressCtrl("s")
}

describe("standing on a thread", () => {
  it("puts the cursor on the thread under the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "why is this here")

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "why is this here")).toContain("▎")
  })

  it("steps over a thread in one move, not one row at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "why is this here")

    // ACT
    await driver.screen.pressKeys(["j", "j"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "const second = 2")).toContain("▎")
  })

  it("settles the thread the cursor is on when a line carries two", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "the first point")
    await sendComment(driver, "the second point")

    // ACT
    await driver.screen.pressKeys(["j", "j"])
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the first point")
    expect(frame).not.toContain("the second point")
  })
})

describe("a settled thread", () => {
  it("folds to a row that says how to open it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "a point worth closing")

    // ACT
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("a point worth closing")
    expect(frame).toContain("settled")
    expect(frame).toContain("press l")
  })

  it("opens again on l", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "a point worth closing")
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("a point worth closing")
    expect(frame).not.toContain("press l")
  })

  it("leaves a comment below it anchored to the right line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "a point worth closing")
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "about the second line")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    const written = comments.find((entry) => entry.body === "about the second line")
    expect(written?.start).toBe(3)
    expect(written?.snippet).toContain("const second = 2")
  })
})

describe("settled threads across a reading", () => {
  it("stays folded when the branch is read again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "closed a while ago")
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("closed a while ago")
    expect(frame).toContain("press l")
  })

  it("keeps an open point in full view", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await sendComment(driver, "still needs an answer")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("still needs an answer")
    expect(frame).not.toContain("press l")
  })
})
