import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 130, height: 18 }
const ACCENT = "#7aa2f7"

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

const lit = async (driver: TestDriver): Promise<number> =>
  (await driver.screen.listForegroundsOfEach("╭")).filter((colour) => colour === ACCENT).length

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(twoFiles)
  await driver.screen.open(WIDE)
  await driver.screen.pressKeys(["RETURN"])
}

describe("the pane a reviewer is in", () => {
  it("draws three panes, each in its own border", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await opened(driver)

    // ASSERT
    const corners = (await driver.screen.getFrame()).split("\n").find((row) => row.includes("╭"))
    expect(corners?.match(/╭/g)).toHaveLength(3)
  })

  it("lights exactly one border at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await opened(driver)

    // ASSERT
    expect(await lit(driver)).toBe(1)
  })

  it("moves the lit border as the focus moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    const first = await driver.screen.listForegroundsOfEach("╭")

    // ACT
    await driver.screen.pressKeys(["TAB"])

    // ASSERT
    expect(await driver.screen.listForegroundsOfEach("╭")).not.toEqual(first)
    expect(await lit(driver)).toBe(1)
  })
})
