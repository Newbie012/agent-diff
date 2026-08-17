import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly id: string }

const idOf = (result: { readonly envelope: unknown }): string =>
  (result.envelope as { comments: ReadonlyArray<Handed> }).comments[0]?.id ?? ""

describe("handing review comments to the agent", () => {
  it("gives the agent every comment written since it last looked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "why third",
    })

    // ACT
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: true,
      comments: [{ body: "why third", file: "src/api.ts", side: "new", start: 4, end: 4 }],
    })
  })

  it("keeps handing a comment over until it is answered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "why third",
    })
    await driver.app.runTake(branch.worktree)

    // ACT
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, comments: [{ body: "why third" }] })
  })

  it("stops handing a comment over once it is answered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "why third",
    })
    const taken = await driver.app.runTake(branch.worktree)

    // ACT
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: idOf(taken),
      body: "dropped it",
    })

    // ASSERT
    expect((await driver.app.runTake(branch.worktree)).envelope).toMatchObject({
      ok: true,
      comments: [],
    })
  })

  it("hands over a comment written after the agent caught up", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "first",
    })
    const taken = await driver.app.runTake(branch.worktree)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: idOf(taken),
      body: "done",
    })

    // ACT
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 5,
      end: 5,
      body: "second",
    })
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, comments: [{ body: "second" }] })
  })

  it("still remembers which files were marked reviewed after the agent takes comments", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "why third",
    })

    // ACT
    await driver.app.runTake(branch.worktree)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: ["src/api.ts"], total: 1 })
  })
})
