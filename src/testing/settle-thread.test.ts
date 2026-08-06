import { describe, expect, it } from "@effect/vitest"
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

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

const openOnThread = async (driver: TestDriver, body = "why this one"): Promise<void> => {
  const branch = await driver.branch.create(oneFile)
  await driver.app.runStage({ branch: branch.name, file: "src/api.ts", start: 2, end: 2, body })
  await driver.app.runSubmit(branch.name)
  await driver.screen.open()
  await driver.screen.pressKeys(["RETURN"])
}

describe("settling a thread from the terminal", () => {
  it("settles the thread the cursor is on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)
    await driver.screen.pressKeys(["j"])
    expect(rowWith(await driver.screen.getFrame(), "sent")).toContain("sent")

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("settled")
  })

  it("offers the key once the cursor reaches the thread", async () => {
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

  it("says so when the cursor is on no thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)

    // ACT
    await driver.screen.pressKeys(["G", "d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no thread here")
  })

  it("keeps a settled thread out of the way of n", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnThread(driver)
    await driver.screen.pressKeys(["j", "d"])
    await driver.screen.pressKeys(["g"])

    // ACT
    await driver.screen.pressKeys(["n"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no open comment")
  })
})
