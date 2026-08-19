import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 200 }, (_, at) => `  const step${at} = ${at};`)

const tall = {
  files: [
    {
      path: "src/tall.ts",
      before: ["export function held() {"],
      after: ["export function held() {", ...body, "}"],
    },
  ],
}

const PAGE_DOWN = "[6~"
const PAGE_UP = "[5~"

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(tall)
  await driver.screen.open({ width: 110, height: 24 })
  await driver.screen.pressKeys(["RETURN"])
}

const cursor = async (driver: TestDriver): Promise<number> => (await driver.screen.believes()).cursor

describe("the keys a reviewer presses without being told", () => {
  it("moves down a page on page down, the way ctrl+d does", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    const before = await cursor(driver)

    // ACT
    await driver.screen.pressKeys([PAGE_DOWN])

    // ASSERT
    expect(await cursor(driver)).toBeGreaterThan(before + 1)
  })

  it("moves back up on page up", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys([PAGE_DOWN, PAGE_DOWN])
    const before = await cursor(driver)

    // ACT
    await driver.screen.pressKeys([PAGE_UP])

    // ASSERT
    expect(await cursor(driver)).toBeLessThan(before - 1)
  })

  it("goes to the end of the file on end, and back to the top on home", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressKeys(["END"])
    const atEnd = await cursor(driver)
    await driver.screen.pressKeys(["HOME"])

    // ASSERT
    expect(atEnd).toBeGreaterThan(100)
    expect(await cursor(driver)).toBe(0)
  })
})
