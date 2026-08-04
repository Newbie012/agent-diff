import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { StoryInput } from "./index.ts"

const change = (path: string, name: string) => ({
  path,
  before: [`const ${name} = 1`],
  after: [`const ${name} = 1`, `const ${name}Added = 2`],
})

const threeFiles = {
  files: [
    change("src/model.ts", "model"),
    change("src/api.ts", "api"),
    change("src/ui/Panel.tsx", "panel"),
  ],
}

const story: StoryInput = {
  summary: "Invitations, end to end",
  steps: [
    {
      title: "Add the invitation data model",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
    {
      title: "Add the invitation API",
      spans: [{ path: "src/api.ts", start: 1, end: 2 }],
    },
  ],
}

const noted: StoryInput = {
  summary: "Invitations, end to end",
  steps: [
    {
      title: "Let a rule write carry the team id through the queue",
      note: "The queue dropped the team id, so support could not tell which team ran out of seats.",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
    {
      title: "Give each endpoint its own error",
      spans: [{ path: "src/api.ts", start: 1, end: 2 }],
    },
  ],
}

const railRows = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => line.slice(0, 35).trimEnd())

const paneOf = (frame: string): string => railRows(frame).join("\n")

describe("walking a review by the argument instead of the filesystem", () => {
  it("lists the story's steps, numbered and counted, in place of the file tree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, story)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("1. Add the invitation")
    expect(pane).toContain("2. Add the invitation")
    expect(pane).not.toContain("Panel.tsx")
  })

  it("puts the files no step claims in a group of their own, so nothing hides", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, story)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(paneOf(await driver.screen.getFrame())).toContain("not in any step")
  })

  it("scopes the diff to the step the reviewer is standing on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, story)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    expect(await driver.screen.getFrame()).toContain("src/model.ts")

    // ACT
    await driver.screen.pressKeys(["TAB", "j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api.ts")
    expect(frame).toContain("apiAdded")
    expect(frame).not.toContain("modelAdded")
  })

  it("goes back to the file tree when the reviewer asks for it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, story)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["s"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("Panel.tsx")
    expect(pane).not.toContain("1. Add the invitation")
  })

  it("wraps a title too long for the rail instead of cutting it off", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, noted)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rail = paneOf(await driver.screen.getFrame())
    expect(rail).toContain("Let a rule write")
    expect(rail).toContain("queue")
    expect(rail).not.toContain("…")
  })

  it("opens a step onto the prose that explains it, and closes it again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, noted)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    expect(paneOf(await driver.screen.getFrame())).not.toContain("dropped")

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const open = paneOf(await driver.screen.getFrame())
    expect(open).toContain("dropped")
    expect(open).toContain("seats")

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    expect(paneOf(await driver.screen.getFrame())).not.toContain("dropped")
  })

  it("keeps the file count on the title line while the step is open", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, noted)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const title = railRows(await driver.screen.getFrame()).find((line) => line.includes("1."))
    expect(title).toBeDefined()
    expect(title?.endsWith("1")).toBe(true)
  })

  it("says so when a step carries no prose, rather than opening onto nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runStorySet(branch.worktree, noted)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["TAB", "j", "l"])

    // ASSERT
    expect(paneOf(await driver.screen.getFrame())).toContain("no note")
  })

  it("shows the file tree when the branch has no story at all", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("Panel.tsx")
    expect(pane).not.toContain("not in any step")
  })
})
