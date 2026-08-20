import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
}

const composing = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(oneFile)
  await driver.screen.open({ review: true })
  await driver.screen.pressKeys(["ARROW_DOWN", "c"])
}

const typing = (text: string): ReadonlyArray<string> => text.split("")

describe("when a comment is being typed", () => {
  test("then what is typed next lands where the caret stands", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await composing(driver)

    // ACT
    await driver.screen.pressKeys(typing("hlo"))
    await driver.screen.pressKeys(["ARROW_LEFT", "ARROW_LEFT"])
    await driver.screen.pressKeys(typing("el"))

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("hello")
    expect(await driver.screen.caretOffset()).toBe(3)
  })

  test("then backspace deletes behind the caret", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await composing(driver)

    // ACT
    await driver.screen.pressKeys(typing("axbc"))
    await driver.screen.pressKeys(["ARROW_LEFT", "ARROW_LEFT", "BACKSPACE"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("abc")
    expect(await driver.screen.caretOffset()).toBe(1)
  })

  test("then the caret moves a whole word at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await composing(driver)

    // ACT
    await driver.screen.pressKeys(typing("second"))
    await driver.screen.pressMeta("ARROW_LEFT")
    await driver.screen.pressKeys(typing("first "))

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("first second")
    expect(await driver.screen.caretOffset()).toBe(6)
  })

  test("then the comment sends what was written", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await composing(driver)

    // ACT
    await driver.screen.pressKeys(typing("hlo"))
    await driver.screen.pressKeys(["ARROW_LEFT", "ARROW_LEFT"])
    await driver.screen.pressKeys(typing("el"))
    await driver.screen.pressCtrl("s")

    // ASSERT
    const frame = await driver.screen.waitForFrame("hello")
    expect(frame).not.toContain("▌")
  })
})
