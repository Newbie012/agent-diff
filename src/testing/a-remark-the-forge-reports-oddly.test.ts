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
    readonly by: string
    readonly body: string
    readonly state: string
    readonly placed: boolean
    readonly outdated: boolean
    readonly start: number
    readonly end: number
  }>
}

const listed = (result: { readonly envelope: unknown }): Listed["remarks"] =>
  (result.envelope as Listed).remarks

const holding = async (
  driver: TestDriver,
  threads: ReadonlyArray<Record<string, unknown>>,
  threadsRaw?: string,
) => {
  const branch = await driver.branch.create(oneFile)
  await driver.forge.holds(
    [{ branch: branch.name, threads: threads as never }],
    threadsRaw === undefined ? {} : { threadsRaw },
  )
  return branch
}

const nulled = `{"data":{"repository":{"pullRequest":{"reviewThreads":{"nodes":[{
  "id":"PRRT_null","isResolved":false,"isOutdated":true,"path":"src/api.ts","diffSide":"RIGHT",
  "line":null,"originalLine":4,"startLine":null,"originalStartLine":null,
  "comments":{"nodes":[{
    "author":null,"body":"this loop reads the file twice",
    "diffHunk":"@@ -1 +1,4 @@\\n+const gone = 1","originalCommit":null
  }]}
}]}}}}}`

describe("when a thread has no line because the forge calls it outdated", () => {
  test("then the remark is still listed, marked outdated, and the fetch does not fail", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await holding(driver, [], nulled)

    // ACT
    const found = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(found.code).toBe(0)
    expect(listed(found)).toHaveLength(1)
    expect(listed(found)[0]?.outdated).toBe(true)
    expect(listed(found)[0]?.placed).toBe(false)
  })

  test("then a comment left by an account that has gone still names somebody", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await holding(driver, [], nulled)

    // ACT
    const found = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(listed(found)[0]?.by).toBe("someone")
  })
})

describe("when a remark carries no code to match", () => {
  test("then the remark sits on the line the forge reported", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await holding(driver, [
      { id: "PRRT_bare", path: "src/api.ts", line: 2, hunk: "", comments: [{ by: "dana", body: "why" }] },
    ])

    // ACT
    const found = await driver.app.runRemarks(branch.name)

    // ASSERT
    expect(listed(found)[0]?.placed).toBe(true)
    expect(listed(found)[0]?.end).toBe(2)
  })
})

describe("when a remark suggests code", () => {
  test("then the agent is handed the words without the fence around them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await holding(driver, [
      {
        id: "PRRT_fix",
        path: "src/api.ts",
        line: 2,
        hunk: "@@ -1 +1,3 @@\n+const first = 1",
        comments: [{ by: "dana", body: "```suggestion\nconst first = 2\n```" }],
      },
    ])
    await driver.app.runRemarks(branch.name)

    // ACT
    await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_fix" })

    // ASSERT
    const handed = await driver.agent.listComments(branch.worktree)
    expect(handed[0]?.body).toBe("@dana on the pull request: const first = 2")
  })
})

describe("when a remark has no words in it", () => {
  test("then the comment says a remark arrived with none", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await holding(driver, [
      { id: "PRRT_mute", path: "src/api.ts", line: 2, hunk: "@@ -1 +1,3 @@\n+const first = 1", comments: [{ by: "dana", body: "" }] },
    ])
    await driver.app.runRemarks(branch.name)

    // ACT
    await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_mute" })

    // ASSERT
    const handed = await driver.agent.listComments(branch.worktree)
    expect(handed[0]?.body).toBe("@dana left a remark with no words on the pull request")
  })
})

describe("when a remark has already been accepted", () => {
  test("then dismissing it is refused and names the comment holding it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await holding(driver, [
      { id: "PRRT_one", path: "src/api.ts", line: 2, hunk: "@@ -1 +1,3 @@\n+const first = 1", comments: [{ by: "dana", body: "why" }] },
    ])
    await driver.app.runRemarks(branch.name)
    await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_one" })

    // ACT
    const asked = await driver.app.runRemarkDismiss({ branch: branch.name, id: "PRRT_one" })

    // ASSERT
    expect(asked.code).not.toBe(0)
    expect(JSON.stringify(asked.envelope)).toContain("RemarkTaken")
    expect(JSON.stringify(asked.envelope)).not.toContain("Re-run with the same arguments")
  })

  test("then removing that comment frees the remark to be triaged again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await holding(driver, [
      { id: "PRRT_one", path: "src/api.ts", line: 2, hunk: "@@ -1 +1,3 @@\n+const first = 1", comments: [{ by: "dana", body: "why" }] },
    ])
    await driver.app.runRemarks(branch.name)
    const done = await driver.app.runRemarkAccept({ branch: branch.name, id: "PRRT_one" })
    const comment = (done.envelope as { comment: string }).comment

    // ACT
    await driver.app.runRemove({ branch: branch.name, id: comment })

    // ASSERT
    expect(listed(await driver.app.runRemarks(branch.name))[0]?.state).toBe("waiting")
  })
})
