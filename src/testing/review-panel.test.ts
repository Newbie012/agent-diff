import { describe, expect, test } from "@effect/vitest"
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
  await driver.screen.open({ ...WIDE, review: true })
}

describe("when the review panel is drawn", () => {
  test("then the panel lists the comments on the branch", async () => {
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
    expect(frame).toContain("Not picked up")
    expect(frame).toContain("src/api.ts:2")
    expect(frame).toContain("why this one")
  })

  test("then a narrow terminal leaves the panel out", async () => {
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
    await driver.screen.open({ width: 100, height: 32, review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Not picked up")
  })

  test("then hiding the panel gives its columns back", async () => {
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
    expect(await driver.screen.getFrame()).not.toContain("Not picked up")
  })

  test("then the panel lists every comment the agent is holding", async () => {
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
    expect(frame).toContain("Not picked up")
    expect(frame).toContain("still mine")
    expect(frame).toContain("already handed over")
  })

  test("then the cursor lands on the comment the reviewer opens", async () => {
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
