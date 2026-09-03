import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const holdComments = async (driver: TestDriver): Promise<void> => {
  await driver.screen.pressKeys([","])
  await driver.screen.pressKeys(["j", "j", "j", "j", "j", "j", "j", "RETURN"])
  await driver.screen.pressEscape()
}

describe("when a comment is held until the review is sent", () => {
  test("then the diff shows the held comment under its line as waiting to be sent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await holdComments(driver)
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("why first")

    // ASSERT
    expect(await driver.agent.listComments(branch.worktree)).toEqual([])
    const lines = (await driver.screen.getFrame()).split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    expect(anchor).toBeGreaterThan(0)
    expect(lines[anchor + 1]).toContain("waiting to be sent")
    expect(lines[anchor + 2]).toContain("why first")
  })

  test("then the held comment reads as sent once the review goes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await holdComments(driver)
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")

    // ACT
    await driver.screen.pressKeys(["C"])

    // ASSERT
    expect((await driver.agent.listComments(branch.worktree)).map((one) => one.body)).toEqual([
      "why first",
    ])
    const lines = (await driver.screen.getFrame()).split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    expect(lines[anchor + 1]).toContain("sent")
    expect(lines[anchor + 1]).not.toContain("waiting to be sent")
    expect(lines[anchor + 2]).toContain("why first")
  })
})
