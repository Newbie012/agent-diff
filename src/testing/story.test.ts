import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { StoryInput } from "./index.ts"

const twoFiles = {
  files: [
    {
      path: "src/model.ts",
      before: ["const model = 1"],
      after: ["const model = 1", "const invite = 2"],
    },
    { path: "src/api.ts", before: ["const api = 1"], after: ["const api = 1", "const post = 2"] },
  ],
}

const wholeStory: StoryInput = {
  summary: "Invitations, end to end",
  steps: [
    {
      title: "Add the invitation data model",
      note: "The record every later step leans on",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
    {
      title: "Add the invitation API",
      spans: [{ path: "src/api.ts", start: 1, end: 2 }],
    },
  ],
}

const halfStory: StoryInput = {
  summary: "Half a change",
  steps: [
    {
      title: "Add the invitation data model",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
  ],
}

type Report = {
  readonly version: number
  readonly parent?: number
  readonly stale: boolean
  readonly summary: string
  readonly covered: number
  readonly total: number
  readonly uncovered: ReadonlyArray<{ readonly path: string }>
  readonly vanished: ReadonlyArray<string>
  readonly steps: ReadonlyArray<{ readonly title: string; readonly files: ReadonlyArray<string> }>
}

const storyOf = (envelope: unknown): Report => (envelope as { story: Report }).story

describe("reading a diff in the order the agent built it", () => {
  it("hands the reviewer the steps the agent wrote, in the agent's order", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runStorySet(branch.worktree, wholeStory)

    // ACT
    const result = await driver.app.runStoryShow(branch.worktree)

    // ASSERT
    expect(result.code).toBe(0)
    const story = storyOf(result.envelope)
    expect(story.summary).toBe("Invitations, end to end")
    expect(story.steps.map((step) => step.title)).toEqual([
      "Add the invitation data model",
      "Add the invitation API",
    ])
    expect(story.steps.map((step) => step.files)).toEqual([["src/model.ts"], ["src/api.ts"]])
    expect(story.covered).toBe(story.total)
    expect(story.uncovered).toEqual([])
  })

  it("reports the hunks no step claims, so a story cannot hide code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const written = await driver.app.runStorySet(branch.worktree, halfStory)

    // ASSERT
    const story = storyOf(written.envelope)
    expect(story.covered).toBe(1)
    expect(story.total).toBe(2)
    expect(story.uncovered.map((span) => span.path)).toEqual(["src/api.ts"])
    const shown = storyOf((await driver.app.runStoryShow(branch.worktree)).envelope)
    expect(shown.uncovered.map((span) => span.path)).toEqual(["src/api.ts"])
  })

  it("supersedes the story it replaces instead of losing the earlier version", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runStorySet(branch.worktree, halfStory)

    // ACT
    await driver.app.runStorySet(branch.worktree, wholeStory)

    // ASSERT
    const story = storyOf((await driver.app.runStoryShow(branch.worktree)).envelope)
    expect(story.version).toBe(2)
    expect(story.parent).toBe(1)
    expect(story.stale).toBe(false)
  })

  it("says a story is stale once the branch moves past the commit it describes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runStorySet(branch.worktree, wholeStory)

    // ACT
    await driver.branch.commitAll(branch, "ship the invitations")

    // ASSERT
    const story = storyOf((await driver.app.runStoryShow(branch.worktree)).envelope)
    expect(story.stale).toBe(true)
  })

  it("returns only the asked-for fields, so a caller pays for what it reads", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runStorySet(branch.worktree, wholeStory)

    // ACT
    const result = await driver.app.runStoryShow(branch.worktree, ["--fields", "covered,total"])

    // ASSERT
    expect(result.envelope).toEqual({ ok: true, story: { covered: 2, total: 2 } })
  })

  it("says there is no story rather than pretending the diff has one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const result = await driver.app.runStoryShow(branch.worktree)

    // ASSERT
    expect(result.code).toBe(3)
    expect(result.stdout).toBe("")
    expect(result.envelope).toMatchObject({ ok: false, error: { type: "NoStory" } })
  })

  it("refuses a story whose steps say nothing, and says what a story looks like", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const result = await driver.app.runStorySet(branch.worktree, '{"steps":[{"title":""}]}')

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "MalformedStory", retriable: false },
    })
  })

  it("names the files a step points at that the branch no longer changes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const result = await driver.app.runStorySet(branch.worktree, {
      steps: [
        { title: "Touch a file that is not here", spans: [{ path: "src/gone.ts", start: 1, end: 2 }] },
      ],
    })

    // ASSERT
    expect(storyOf(result.envelope).vanished).toEqual(["src/gone.ts"])
  })
})
