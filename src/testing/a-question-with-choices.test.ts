import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Said = { readonly body: string; readonly voice?: string; readonly choices?: ReadonlyArray<string> }

type Listed = {
  readonly state: string
  readonly answers: ReadonlyArray<Said>
  readonly turns: ReadonlyArray<Said>
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

describe("when the agent asks the reviewer something and offers choices", () => {
  test("then comment list carries the choices on the agent's turn and answer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)

    // ACT
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id,
      body: "drop it, or keep it and map the error?",
      asks: true,
      choices: ["Drop it", "Keep it and map the error"],
    })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed?.state).toBe("question")
    expect(listed?.answers[0]?.choices).toEqual(["Drop it", "Keep it and map the error"])
    expect(listed?.turns.at(-1)?.choices).toEqual(["Drop it", "Keep it and map the error"])
  })

  test("then choices given without --question still mark the answer a question", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)

    // ACT
    await driver.app.runAnswer({ worktree: branch.worktree, id, body: "which?", choices: ["This", "That"] })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed?.state).toBe("question")
  })

  test("then a question with only one choice is refused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)

    // ACT
    const said = await driver.app.runAnswer({ worktree: branch.worktree, id, body: "ok?", choices: ["Yes"] })

    // ASSERT
    expect(said.code).toBe(2)
    expect(said.envelope).toMatchObject({ ok: false, error: { type: "BadOption" } })
  })

  test("then a question with five choices is refused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)

    // ACT
    const said = await driver.app.runAnswer({
      worktree: branch.worktree,
      id,
      body: "which?",
      choices: ["one", "two", "three", "four", "five"],
    })

    // ASSERT
    expect(said.code).toBe(2)
    expect(said.envelope).toMatchObject({ ok: false, error: { type: "BadOption" } })
  })
})

describe("when the agent asks the reviewer something without offering choices", () => {
  test("then comment list carries no choices on the answer or its turn", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await taken(driver)

    // ACT
    await driver.app.runAnswer({ worktree: branch.worktree, id, body: "which one?", asks: true })

    // ASSERT
    const [listed] = listedOf((await driver.app.runThreads(branch.name)).envelope)
    expect(listed?.answers[0]).not.toHaveProperty("choices")
    expect(listed?.turns.at(-1)).not.toHaveProperty("choices")
  })
})
