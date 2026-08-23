import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  name: "resend-expired-invites",
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const thread = {
  id: "PRRT_one",
  path: "src/api.ts",
  line: 2,
  hunk: "@@ -1 +1,3 @@\n const keep = 0\n+const first = 1",
  comments: [{ by: "dana", body: "this re-reads the file on every pass" }],
}

const spoken = {
  id: "PRRT_talk",
  path: "src/api.ts",
  line: 3,
  hunk: "@@ -1 +1,3 @@\n+const second = 2",
  comments: [
    { by: "dana", body: "twelve hours is short" },
    { by: "sam", body: "the runbook says twelve" },
  ],
}

const stale = {
  id: "PRRT_old",
  path: "src/api.ts",
  line: 9,
  outdated: true,
  hunk: "@@ -1 +9,2 @@\n+const removedSince = 1",
  comments: [{ by: "dana", body: "this name reads as a count" }],
}

const HELD_NOTICE_MS = 60_000

const reading = async (
  driver: TestDriver,
  threads: ReadonlyArray<Record<string, unknown>>,
  width = 160,
) => {
  const branch = await driver.branch.create(oneFile)
  await driver.forge.holds([{ branch: branch.name, threads: threads as never }])
  await driver.screen.open({ width, height: 24, review: true, noticeMs: HELD_NOTICE_MS })
  return branch
}

const rowWith = (frame: string, text: string): number =>
  frame.split("\n").findIndex((row) => row.includes(text))

describe("when the pull request has a remark on a line of the diff", () => {
  test("then the remark shows under that line with the handle that left it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver, [thread], 120)

    // ACT
    const frame = await driver.screen.getFrame()

    // ASSERT
    const code = rowWith(frame, "const first = 1")
    expect(code).toBeGreaterThan(0)
    expect(frame.split("\n")[code + 1]).toContain("@dana")
    expect(frame.split("\n")[code + 2]).toContain("this re-reads the file on every pass")
  })

  test("then the review panel lists it under Remarks", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver, [thread])

    // ACT
    const frame = await driver.screen.getFrame()

    // ASSERT
    expect(rowWith(frame, "Remarks")).toBeGreaterThan(0)
    expect(rowWith(frame, "src/api.ts:2")).toBeGreaterThan(rowWith(frame, "Remarks"))
  })
})

describe("when a remark has replies", () => {
  test("then every handle in the thread is drawn", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver, [spoken], 120)

    // ACT
    const frame = await driver.screen.getFrame()

    // ASSERT
    expect(frame).toContain("@dana")
    expect(frame).toContain("@sam")
    expect(frame).toContain("the runbook says twelve")
  })
})

describe("when the forge calls a remark's thread outdated", () => {
  test("then the review panel says the remark is outdated", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver, [stale])

    // ACT
    const frame = await driver.screen.getFrame()

    // ASSERT
    expect(rowWith(frame, "outdated")).toBeGreaterThan(0)
    expect(frame).not.toContain("this name reads as a count\n     ")
  })
})

describe("when a remark is accepted from the diff", () => {
  test("then the agent is handed it and the remark leaves the Remarks section", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await reading(driver, [thread])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["A"])

    // ASSERT
    const handed = await driver.agent.listComments(branch.worktree)
    expect(handed.map((one) => one.body)).toEqual([
      "@dana on the pull request: this re-reads the file on every pass",
    ])
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Not picked up")
  })
})

describe("when a remark is dismissed from the diff", () => {
  test("then the remark moves to Dismissed and nothing reaches the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await reading(driver, [thread])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["X"])
    const gone = await driver.screen.getFrame()

    // ASSERT
    expect(rowWith(gone, "Dismissed")).toBeGreaterThan(0)
    expect(await driver.agent.listComments(branch.worktree)).toEqual([])
  })
})

describe("when the keys that settle and reply are pressed on a remark", () => {
  test("then nothing is settled and the review says the remark is not a thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await reading(driver, [thread])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const listed = await driver.app.runRemarks(branch.name)
    expect(
      (listed.envelope as { remarks: ReadonlyArray<{ state: string }> }).remarks[0]?.state,
    ).toBe("waiting")
    expect(await driver.screen.getFrame()).toContain("no thread here")
  })
})

describe("when the diff holds remarks and no comments", () => {
  test("then the walk to the next comment reaches the remark", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver, [spoken], 120)

    // ACT
    await driver.screen.pressKeys(["n"])

    // ASSERT
    expect(await driver.screen.rowWith("const second = 2")).toContain("▎")
  })
})

describe("when a remark runs to hundreds of lines", () => {
  test("then the diff keeps the code below it on screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const long = {
      id: "PRRT_long",
      path: "src/api.ts",
      line: 2,
      hunk: "@@ -1 +1,3 @@\n+const first = 1",
      comments: [{ by: "dana", body: Array.from({ length: 200 }, (_, at) => `point ${at}`).join("\n") }],
    }
    await reading(driver, [long], 120)

    // ACT
    const frame = await driver.screen.getFrame()

    // ASSERT
    expect(frame).toContain("more lines, press o to read it")
    expect(frame).toContain("const second = 2")
  })
})

describe("when a line carries both my comment and a remark", () => {
  test("then A accepts the remark and X removes the comment", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await reading(driver, [thread])
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "mine about this line",
    })
    await driver.screen.pressKeys(["r"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["A"])

    // ASSERT
    const handed = await driver.agent.listComments(branch.worktree)
    expect(handed.map((one) => one.body)).toContain(
      "@dana on the pull request: this re-reads the file on every pass",
    )
    expect(handed.map((one) => one.body)).toContain("mine about this line")
  })
})

describe("when a remark is answered from the review", () => {
  test("then the reply reaches the thread on the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await reading(driver, [thread])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["R"])
    await driver.screen.typeText("fair, the retry loop reads it again")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const posted = await driver.forge.posts()
    expect(JSON.stringify(posted)).toContain("fair, the retry loop reads it again")
    expect(await driver.screen.getFrame()).toContain("replied on the pull request")
    expect(await driver.agent.listComments(branch.worktree)).toEqual([])
  })
})
