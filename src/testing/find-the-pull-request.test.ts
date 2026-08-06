import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
}

const footerOf = (frame: string): string => {
  const lines = frame.split("\n").filter((line) => line.trim().length > 0)
  return lines.at(-1) ?? ""
}

describe("reaching the pull request while reading the diff", () => {
  it("names the key in the footer of the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).toContain("pull request")
  })

  it("says in the header that the branch has one", async () => {
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

  it("opens it from the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["p"])

    // ASSERT
    const asked = await driver.app.listForgeRequests()
    expect(asked.some((line) => line.includes(`pr view ${branch.name} --web`))).toBe(true)
  })
})

describe("a branch the forge says has no pull request", () => {
  it("stops offering the key", async () => {
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

describe("a forge that cannot answer", () => {
  it("says the worktree list could not find out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.app.setForgeSilent()

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("could not find out")
  })

  it("keeps the key out of the footer, but still lists it under ?", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.app.setForgeSilent()
    await driver.screen.open()
    expect(footerOf(await driver.screen.getFrame())).not.toContain("pull request")

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Open the pull request")
  })
})
