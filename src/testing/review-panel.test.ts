import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 160, height: 32 }

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
    {
      path: "src/web.ts",
      before: ["const w = 1"],
      after: ["const w = 1", "const x = 2", "const y = 3"],
    },
  ],
}

const openWide = async (driver: TestDriver): Promise<void> => {
  await driver.screen.open(WIDE)
  await driver.screen.pressKeys(["RETURN"])
}

describe("the review panel", () => {
  it("lists the comments on the branch when the terminal is wide enough", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why this one",
    })

    // ACT
    await openWide(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("With the agent")
    expect(frame).toContain("src/api.ts:2")
    expect(frame).toContain("why this one")
  })

  it("stays out of the way when the terminal is narrow", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why this one",
    })

    // ACT
    await driver.screen.open({ width: 100, height: 32 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("With the agent")
  })

  it("gives the columns back when the reviewer hides it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why this one",
    })
    await openWide(driver)

    // ACT
    await driver.screen.pressKeys(["a"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("With the agent")
  })

  it("lists every comment the agent is holding", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "already handed over",
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/web.ts",
      start: 2,
      end: 2,
      body: "still mine",
    })

    // ACT
    await openWide(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("With the agent")
    expect(frame).toContain("still mine")
    expect(frame).toContain("already handed over")
  })

  it("lands the cursor on the comment the reviewer opens", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/web.ts",
      start: 3,
      end: 3,
      body: "look at this one",
    })
    await openWide(driver)

    // ACT
    await driver.screen.pressKeys(["TAB", "TAB", "RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/web.ts")
  })
})
