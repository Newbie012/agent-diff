import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
}

describe("when the pull request is reached from the worktree list", () => {
  test("then the forge is asked about the branch under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["p"])

    // ASSERT
    const asked = await driver.app.listForgeRequests()
    expect(asked.some((line) => line.includes(`pr view ${branch.name} --web`))).toBe(true)
  })

  test("then the footer reports no pull request on the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.app.setPullRequests([])
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["p"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no pull request")
  })

  test("then the key is offered where there is a pull request to open", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("p pull request")
  })
})
