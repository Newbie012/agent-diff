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

describe("when the cursor stands on a thread", () => {
  test("then the cursor lands on the thread under the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why is this here")

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(await driver.screen.rowWith("why is this here")).toContain("▎")
  })

  test("then the cursor steps over a thread in one move", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why is this here")

    // ACT
    await driver.screen.pressKeys(["j", "j"])

    // ASSERT
    expect(await driver.screen.rowWith("const second = 2")).toContain("▎")
  })

  test("then a line carrying two threads settles the one under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("the first point")
    await driver.screen.writeComment("the second point")

    // ACT
    await driver.screen.pressKeys(["j", "j"])
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the first point")
    expect(frame).not.toContain("the second point")
  })
})

describe("when a thread is settled", () => {
  test("then the thread folds to a row saying how to open it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("a point worth closing")

    // ACT
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("a point worth closing")
    expect(frame).toContain("settled")
    expect(frame).toContain("press l")
  })

  test("then l opens the thread again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("a point worth closing")
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("a point worth closing")
    expect(frame).not.toContain("press l")
  })

  test("then a comment below stays anchored to its own line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("a point worth closing")
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("about the second line")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    const written = comments.find((entry) => entry.body === "about the second line")
    expect(written?.start).toBe(3)
    expect(written?.snippet).toContain("const second = 2")
  })
})

describe("when the branch is read again with settled threads on it", () => {
  test("then a settled thread stays folded", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("closed a while ago")
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("closed a while ago")
    expect(frame).toContain("press l")
  })

  test("then an open point stays in full view", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("still needs an answer")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("still needs an answer")
    expect(frame).not.toContain("press l")
  })
})
