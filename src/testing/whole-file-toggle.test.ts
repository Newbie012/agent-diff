import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const around = Array.from({ length: 40 }, (_, at) => `const far${at} = ${at}`)

const oneChange = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: [...around, "const here = 1"],
      after: [...around, "const here = 2"],
    },
  ],
}

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(oneChange)
  await driver.screen.open({ review: true })
  await driver.screen.pressKeys(["k"])
}

describe("when the whole file is shown", () => {
  test("then one key opens the file the change sits in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    expect(await driver.screen.getFrame()).not.toContain("const far0")

    // ACT
    await driver.screen.pressKeys(["F"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("const far0")
    expect(frame).toContain("whole file")
  })

  test("then pressing again gives the diff back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["F"])

    // ACT
    await driver.screen.pressKeys(["F"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("const far0")
    expect(frame).not.toContain("whole file")
  })

  test("then the context returns to the width the reader chose", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["=", "="])
    expect(await driver.screen.getFrame()).toContain("±25")

    // ACT
    await driver.screen.pressKeys(["F", "F"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("±25")
    expect(frame).not.toContain("whole file")
  })
})
