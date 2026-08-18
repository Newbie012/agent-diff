import { describe, expect, it } from "@effect/vitest"
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
  await driver.screen.open()
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["ARROW_DOWN", "c"])
}

const typing = (text: string): ReadonlyArray<string> => text.split("")

describe("writing a comment", () => {
  it("puts what is typed next where the caret stands", async () => {
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

  it("deletes behind the caret rather than at the end", async () => {
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

  it("moves a whole word at a time", async () => {
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

  it("sends what was written, not the caret", async () => {
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
