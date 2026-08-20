import { describe, expect, test } from "@effect/vitest"
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

describe("when the panes are drawn", () => {
  test("then three panes draw, each in its own border", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })

    // ASSERT
    const corners = (await driver.screen.getFrame()).split("\n").find((row) => row.includes("╭"))
    expect(corners?.match(/╭/g)).toHaveLength(3)
  })

  test("then exactly one border is lit", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })

    // ASSERT
    expect(await lit(driver)).toBe(1)
  })

  test("then the lit border moves with the focus", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })
    const first = await driver.screen.listForegroundsOfEach("╭")

    // ACT
    await driver.screen.pressKeys(["TAB"])

    // ASSERT
    expect(await driver.screen.listForegroundsOfEach("╭")).not.toEqual(first)
    expect(await lit(driver)).toBe(1)
  })
})
