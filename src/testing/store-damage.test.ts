import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { TestDriver, type CreatedBranch } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const NON_SLUG = /[^a-zA-Z0-9]+/g

const damage = async (
  driver: TestDriver,
  created: CreatedBranch,
  file: string,
  text: string,
): Promise<void> => {
  const key = `${created.worktree}#${created.name}`.replace(NON_SLUG, "-")
  const branch = join(driver.storeRoot, "branches", key)
  await mkdir(branch, { recursive: true })
  await writeFile(join(branch, file), text, "utf8")
}

describe("a store file that cannot be trusted", () => {
  it("reports a damaged state file instead of failing unexpectedly", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await damage(driver, branch, "state.json", '{"pending":[{"id":"a",')

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "StoreUnreadable" },
    })
    expect(result.code).toBe(1)
  })

  it("reports a state file holding the wrong shape", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await damage(driver, branch, "state.json", '{"pending":"not a list"}')

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "StoreUnreadable" },
    })
  })

  it("reports a comment the agent cannot read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await damage(driver, branch, "inbox.jsonl", '{"id":"b","comments":[{}]}\n')

    // ACT
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "StoreUnreadable" },
    })
  })

  it("still reads a store nobody has damaged", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why",
    })

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, pending: 1 })
  })
})
