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

describe("when a comment is written", () => {
  test("then the compose box shows the code the comment attaches to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j", "v", "j"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Comment on src/api.ts")
    const echoed = frame.split("\n").filter((line) => line.includes("const first = 1"))
    expect(echoed).toHaveLength(2)
  })

  test("then the compose box takes more than one line of prose", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("first line")

    // ACT
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.typeText("second line")

    // ASSERT
    const lines = (await driver.screen.getFrame()).split("\n")
    expect(lines.some((line) => line.includes("first line") && line.includes("second line"))).toBe(
      false,
    )
    expect(lines.some((line) => line.includes("second line"))).toBe(true)
  })

  test("then the comment sends as soon as it is written", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("this one goes now")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(await driver.agent.listBatches(branch.worktree)).toHaveLength(1)
    expect(await driver.screen.getFrame()).toContain("sent to the agent")
  })
})
