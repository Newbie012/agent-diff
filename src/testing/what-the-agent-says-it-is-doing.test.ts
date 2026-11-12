import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Listed = {
  readonly id: string
  readonly doing?: { readonly body: string; readonly at: string }
}

const listedOf = (envelope: unknown): ReadonlyArray<Listed> =>
  (envelope as { comments: ReadonlyArray<Listed> }).comments

const idOf = (envelope: unknown): string =>
  (envelope as { comments: ReadonlyArray<{ readonly id: string }> }).comments[0]?.id ?? ""

const comment = { file: "src/api.ts", start: 4, end: 4, body: "why is this unused" }

const taken = async (driver: TestDriver) => {
  const branch = await driver.branch.create()
  await driver.app.runComment({ branch: branch.name, ...comment })
  const id = idOf((await driver.app.runTake(branch.worktree)).envelope)
  return { branch, id }
}

describe("when the agent says what it is doing on a comment it took", () => {
  test("then comment list carries the line and when the agent said it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)

    // ACT
    const said = await driver.app.runDoing({ worktree: branch.worktree, id, body: "Editing driver.ts" })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(said.envelope).toMatchObject({ ok: true })
    expect(listed?.doing?.body).toBe("Editing driver.ts")
    expect(listed?.doing?.at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test("then a second line replaces the first in comment list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)
    await driver.app.runDoing({ worktree: branch.worktree, id, body: "Editing driver.ts" })

    // ACT
    await driver.app.runDoing({ worktree: branch.worktree, id, body: "Running the tests" })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed?.doing?.body).toBe("Running the tests")
  })

  test("then the agent's answer clears the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)
    await driver.app.runDoing({ worktree: branch.worktree, id, body: "Editing driver.ts" })

    // ACT
    await driver.app.runAnswer({ worktree: branch.worktree, id, body: "dropped it" })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed).not.toHaveProperty("doing")
  })

  test("then the reviewer settling the thread clears the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)
    await driver.app.runDoing({ worktree: branch.worktree, id, body: "Editing driver.ts" })

    // ACT
    await driver.app.runResolve({ branch: branch.name, id })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed).not.toHaveProperty("doing")
  })

  test("then the reviewer removing the comment clears the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)
    await driver.app.runDoing({ worktree: branch.worktree, id, body: "Editing driver.ts" })

    // ACT
    await driver.app.runRemove({ branch: branch.name, id })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed).not.toHaveProperty("doing")
  })

  test("then a line said on a reply shows on the thread the reply continues", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)
    await driver.app.runAnswer({ worktree: branch.worktree, id, body: "which one" })
    await driver.app.run(["comment", "reply", "--worktree", branch.worktree, "--to", id, "--body", "the import"])
    const reply = idOf((await driver.app.runTake(branch.worktree)).envelope)

    // ACT
    await driver.app.runDoing({ worktree: branch.worktree, id: reply, body: "Dropping the import" })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed?.id).toBe(id)
    expect(listed?.doing?.body).toBe("Dropping the import")
  })

  test("then a line with a line break in it is refused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)

    // ACT
    const said = await driver.app.runDoing({ worktree: branch.worktree, id, body: "one\ntwo" })

    // ASSERT
    expect(said.code).toBe(2)
    expect(said.envelope).toMatchObject({ ok: false, error: { type: "BadOption" } })
  })

  test("then a client watching through adiff serve hears the line change", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)
    const served = driver.app.serve()
    const watching = await served.watch(["--worktree", branch.worktree])
    await served.settledOn(watching.id)

    // ACT
    const changed = served.changeOn(watching.id)
    await driver.app.runDoing({ worktree: branch.worktree, id, body: "Editing driver.ts" })

    // ASSERT
    expect(await changed).toMatchObject({ id: watching.id, event: "changed" })
  })
})

describe("when the agent took a comment and has said nothing about it", () => {
  test("then comment list carries no doing field on the comment", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch } = await taken(driver)

    // ACT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)

    // ASSERT
    expect(listed).not.toHaveProperty("doing")
  })
})
