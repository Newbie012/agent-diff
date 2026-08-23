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

type Listed = {
  readonly remarks: ReadonlyArray<{
    readonly id: string
    readonly file: string
    readonly side: string
    readonly start: number
    readonly end: number
    readonly by: string
    readonly body: string
    readonly outdated: boolean
    readonly state: string
    readonly replies: ReadonlyArray<{ readonly by: string; readonly body: string }>
  }>
}

const remarksIn = (result: { readonly envelope: unknown }): Listed["remarks"] =>
  (result.envelope as Listed).remarks

const thread = {
  id: "PRRT_one",
  path: "src/api.ts",
  line: 2,
  comments: [{ by: "dana", body: "this re-reads the file on every pass" }],
}

const second = {
  id: "PRRT_two",
  path: "src/api.ts",
  line: 3,
  comments: [
    { by: "sam", body: "twelve hours would match the runbook" },
    { by: "dana", body: "the runbook is out of date" },
  ],
}

const settled = {
  id: "PRRT_done",
  path: "src/api.ts",
  line: 2,
  resolved: true,
  comments: [{ by: "dana", body: "never mind, I misread it" }],
}

describe("when the pull request carries review remarks", () => {
  test("then each remark carries the handle that left it, the body and every reply", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread, second] }])

    // ACT
    const listed = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(remarksIn(listed).map((one) => [one.by, one.body, one.start])).toEqual([
      ["dana", "this re-reads the file on every pass", 2],
      ["sam", "twelve hours would match the runbook", 3],
    ])
    expect(remarksIn(listed)[1]?.replies).toEqual([
      { by: "dana", body: "the runbook is out of date" },
    ])
  })

  test("then a thread the forge has resolved is left out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread, settled] }])

    // ACT
    const listed = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(remarksIn(listed).map((one) => one.id)).toEqual(["PRRT_one"])
  })

  test("then reading twice leaves one copy of each remark", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }])
    await driver.app.runRemarks(branch.name)

    // ACT
    const listed = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(remarksIn(listed).map((one) => one.id)).toEqual(["PRRT_one"])
  })
})

describe("when the branch has no pull request", () => {
  test("then the remarks list is empty and the command still succeeds", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([])

    // ACT
    const listed = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(listed.code).toBe(0)
    expect(remarksIn(listed)).toEqual([])
  })
})

describe("when the forge cannot be reached", () => {
  test("then the remarks command names the forge and exits non-zero", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], { refuses: true })

    // ACT
    const listed = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(listed.code).not.toBe(0)
    expect(JSON.stringify(listed.envelope)).toContain("ForgeUnavailable")
  })
})

describe("when the forge answers nothing a review can read", () => {
  test("then the review says the forge did not answer and still opens", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], {
      threadsRaw: "<html>not json</html>",
    })

    // ACT
    await driver.screen.open({ width: 160, height: 24, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the forge did not answer")
    expect(frame).toContain("const first = 1")
  })
})

describe("when the pull request has more threads than one page holds", () => {
  test("then every page is read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const later = {
      id: "PRRT_page2",
      path: "src/api.ts",
      line: 3,
      comments: [{ by: "sam", body: "and this one is on the next page" }],
    }
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], {
      morePages: [[later]],
    })

    // ACT
    const listed = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(remarksIn(listed).map((one) => one.id)).toEqual(["PRRT_one", "PRRT_page2"])
  })
})
