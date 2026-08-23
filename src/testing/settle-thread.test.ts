import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
  ],
}

const openOnThread = async (driver: TestDriver, body = "why this one"): Promise<void> => {
  const branch = await driver.branch.create(oneFile)
  await driver.app.runComment({ branch: branch.name, file: "src/api.ts", start: 2, end: 2, body })
  await driver.screen.open({ review: true })
}

describe("when a thread is settled from the terminal", () => {
  test("then the thread under the cursor settles", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)
    await driver.screen.pressKeys(["j"])
    expect(await driver.screen.rowWith("sent")).toContain("sent")

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("settled")
  })

  test("then the key is offered once the cursor reaches the thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)
    expect(await driver.screen.getFrame()).not.toContain("d settle")

    // ACT
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("d settle")
  })

  test("then the key sheet names the key", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)

    // ACT
    await driver.screen.pressCtrl("p")
    await driver.screen.typeText("settle")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const row = frame.split("\n").find((line) => line.includes("Settle the thread here")) ?? ""
    expect(row).toContain("d")
  })

  test("then the footer reports no thread under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)

    // ACT
    await driver.screen.pressKeys(["G", "d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no thread here")
  })

  test("then n skips the settled thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)
    await driver.screen.pressKeys(["j", "d"])
    await driver.screen.pressKeys(["g"])

    // ACT
    await driver.screen.pressKeys(["n"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing else waiting on you here")
  })
})
