import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "../../index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 130, height: 32 })
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys([","])
}

describe("when the preferences screen is opened", () => {
  test("then every preference says what it does and whether it is on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await opened(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Wrap long lines")
    expect(frame).toContain("Long lines wrap instead of running off the edge.")
    expect(frame).toContain("Keep the heading in view")
  })

  test("then escape goes back to the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("What adiff does")
    expect(frame).toContain("const one = 2")
  })
})

describe("when a preference is turned on from the screen", () => {
  test("then long lines wrap straight away", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    expect(await driver.screen.believes()).toMatchObject({ wrap: false })

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.believes()).toMatchObject({ wrap: true })
  })

  test("then long lines still wrap the next time adiff opens", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.restart({ width: 130, height: 32 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.believes()).toMatchObject({ wrap: true })
  })

  test("then pressing w turns wrapping off again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressEscape()
    await driver.screen.pressKeys(["w"])
    expect(await driver.screen.believes()).toMatchObject({ wrap: true })

    // ACT
    await driver.screen.pressKeys([","])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const found = rows.find((row) => row.includes("Wrap long lines")) ?? ""
    expect(found).toContain("✓")
  })
})
