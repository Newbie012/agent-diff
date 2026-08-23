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

const gone = {
  id: "PRRT_gone",
  path: "src/api.ts",
  line: 9,
  outdated: true,
  hunk: "@@ -1 +9,2 @@\n+const removedSince = 1",
  comments: [{ by: "dana", body: "this name reads as a count" }],
}

type Remarks = {
  readonly remarks: ReadonlyArray<{
    readonly id: string
    readonly state: string
    readonly outdated: boolean
    readonly placed: boolean
  }>
}

const stateOf = (result: { readonly envelope: unknown }, id: string): string | undefined =>
  (result.envelope as Remarks).remarks.find((one) => one.id === id)?.state

const withRemarks = async (
  driver: TestDriver,
  threads: ReadonlyArray<Record<string, unknown>>,
) => {
  const branch = await driver.branch.create(oneFile)
  await driver.forge.holds([{ branch: branch.name, threads: threads as never }])
  await driver.app.runRemarks(branch.name)
  return branch
}

describe("when a remark is accepted", () => {
  test("then the agent is handed a comment quoting the handle, anchored at the code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [thread])

    // ACT
    await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_one" })

    // ASSERT
    const handed = await driver.agent.listComments(branch.worktree)
    expect(handed).toHaveLength(1)
    expect(handed[0]?.body).toBe(
      "@dana on the pull request: this re-reads the file on every pass",
    )
    expect(handed[0]?.snippet).toBe("const first = 1")
    expect(handed[0]?.start).toBe(2)
  })

  test("then the remark reads as accepted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [thread])
    await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_one" })

    // ACT
    const listed = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(stateOf(listed, "PRRT_one")).toBe("accepted")
  })

  test("then accepting it a second time is refused and names the comment holding it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [thread])
    const first = await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_one" })
    const comment = (first.envelope as { accepted: string; comment: string }).comment

    // ACT
    const again = await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_one" })

    // ASSERT
    expect(again.code).not.toBe(0)
    expect(JSON.stringify(again.envelope)).toContain("RemarkTaken")
    expect(JSON.stringify(again.envelope)).toContain(comment)
  })

  test("then a remark the diff cannot show anchors to the file with the code it quoted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [gone])

    // ACT
    await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_gone" })

    // ASSERT
    const handed = await driver.agent.listComments(branch.worktree)
    expect(handed[0]?.snippet).toBe("const removedSince = 1")
    expect(handed[0]?.file).toBe("src/api.ts")
  })
})

describe("when a remark is dismissed", () => {
  test("then the remark reads as dismissed until it is restored", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [thread])

    // ACT
    await driver.app.runRemarkDismiss({ branch: branch.name, id: "PRRT_one" })
    const dismissed = await driver.app.runRemarks(branch.name)
    await driver.app.runRemarkRestore({ branch: branch.name, id: "PRRT_one" })

    // ASSERT
    expect(stateOf(dismissed, "PRRT_one")).toBe("dismissed")
    expect(stateOf(await driver.app.runRemarks(branch.name), "PRRT_one")).toBe("waiting")
  })

  test("then nothing about it reaches the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [thread])

    // ACT
    await driver.app.runRemarkDismiss({ branch: branch.name, id: "PRRT_one" })

    // ASSERT
    expect(await driver.agent.listComments(branch.worktree)).toEqual([])
  })
})

describe("when a remark names an id the pull request does not have", () => {
  test("then the command is refused and names the ids it does have", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [thread])

    // ACT
    const asked = await driver.app.runRemarkDismiss({ branch: branch.name, id: "PRRT_nope" })

    // ASSERT
    expect(asked.code).not.toBe(0)
    expect(JSON.stringify(asked.envelope)).toContain("UnknownRemark")
    expect(JSON.stringify(asked.envelope)).toContain("PRRT_one")
  })
})

describe("when the agent takes what is waiting", () => {
  test("then the hand-over carries the accepted comment and no remark", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withRemarks(driver, [thread, gone])
    await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_one" })

    // ACT
    const taken = await driver.app.runTake(branch.worktree)

    // ASSERT
    const bodies = (taken.envelope as { comments: ReadonlyArray<{ body: string }> }).comments
    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.body).toContain("re-reads the file")
  })
})
