import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const openCompose = async (driver: TestDriver): Promise<void> => {
  await driver.screen.open({ review: true })
  await driver.screen.pressKeys(["c"])
}

describe("when a comment is typed", () => {
  test("then every letter goes through, including the ones bound elsewhere", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await openCompose(driver)

    // ACT
    await driver.screen.typeText("quit or SEND?")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("quit or SEND?")
    expect(frame).toContain("Comment on src/api.ts")
  })

  test("then escape still closes the box", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await openCompose(driver)
    await driver.screen.typeText("half written")

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Comment on")
  })

  test("then letters typed into the palette query stay out of the commands", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressCtrl("p")

    // ACT
    await driver.screen.typeText("mark")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("mark")
    expect(frame).toContain("Mark reviewed")
  })
})
