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

const footer = (frame: string): string =>
  frame.split("\n").find((row) => row.includes("comment") || row.includes("settle")) ?? ""

const send = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.writeComment(body)
}

describe("when the cursor moves onto and off a thread", () => {
  test("then settling is offered only with the cursor on a thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await send(driver, "a point worth settling")

    // ASSERT
    expect(footer(await driver.screen.getFrame())).not.toContain("settle")

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(footer(await driver.screen.getFrame())).toContain("settle")
  })

  test("then the reading chips return as the cursor leaves the thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await send(driver, "a point worth settling")
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(footer(await driver.screen.getFrame())).not.toContain("settle")
  })
})
