import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
}

describe("when the branch has a pull request", () => {
  test("then the footer names the key that opens it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.footer()).toContain("pull request")
  })

  test("then the header says the branch has a pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const header = frame.split("\n").find((line) => line.includes(branch.name)) ?? ""
    expect(header).toContain("open pull request")
  })

  test("then the pull request opens from the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["p"])

    // ASSERT
    const asked = await driver.app.listForgeRequests()
    expect(asked.some((line) => line.includes(`pr view ${branch.name} --web`))).toBe(true)
  })
})

describe("when the forge says the branch has no pull request", () => {
  test("then the footer stops offering the key", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.app.setPullRequests([])

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("pull request")
  })
})

describe("when the forge cannot answer", () => {
  test("then the worktree list says it could not reach the forge", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.app.setForgeSilent()

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("could not reach the forge")
  })

  test("then the key stays out of the footer and stays in the key sheet", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.app.setForgeSilent()
    await driver.screen.open()
    expect(await driver.screen.footer()).not.toContain("pull request")

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Open the pull request")
  })
})
