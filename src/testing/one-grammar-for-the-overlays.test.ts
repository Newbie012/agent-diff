import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const rowWith = (frame: string, text: string): string =>
  rowsOf(frame).find((row) => row.includes(text)) ?? ""

const rowIndexOf = (frame: string, text: string): number =>
  rowsOf(frame).findIndex((row) => row.includes(text))

const reviewing = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 130, height: 32, review: true })
}

describe("when the command palette opens", () => {
  test("then the title, the query and the cursor share one left edge, and the rows sit two columns in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const title = rowWith(frame, "Commands").indexOf("Commands")
    const query = rowWith(frame, "Type to filter").indexOf("›")
    const cursor = rowWith(frame, "Open the pull request").indexOf("▎")
    const command = rowWith(frame, "Next line").indexOf("↓ j")
    expect(title).toBeGreaterThan(0)
    expect(query).toBe(title)
    expect(cursor).toBe(title)
    expect(command).toBe(title + 2)
  })

  test("then down moves the cursor to the very next row on screen, past no headline", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)
    await driver.screen.pressCtrl("p")
    const before = rowIndexOf(await driver.screen.getFrame(), "▎ p ")

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const rows = rowsOf(frame)
    const after = rows.findIndex((row, at) => at > before - 2 && /▎ \S.{0,10}\s{2,}[A-Z]/.test(row))
    expect(before).toBeGreaterThan(0)
    expect(after).toBe(before + 1)
    expect(rows[after]).toContain("Set what this branch is compared against")
  })

  test("then the count of commands sits at the right edge of the title row", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "Commands")).toMatch(/Commands\s{4,}\d+(\s|$)/)
  })

  test("then no heavy line stands at the palette's left edge", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("┃")
  })

  test("then the palette lists its own keys under the commands", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const rows = rowsOf(frame)
    const lastCommand = rows.findLastIndex((row) => row.includes("Moving"))
    const footer = rows.findLastIndex((row) => row.includes("back"))
    const inside = rows.findIndex((row, at) => at > lastCommand && at < footer && row.includes("run"))
    expect(inside).toBeGreaterThan(lastCommand)
  })
})

describe("when the palette scrolls to a command deep in its group", () => {
  test("then the group's headline stays on screen above the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 130, height: 20, review: true })
    await driver.screen.pressCtrl("p")

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN", "ARROW_DOWN", "ARROW_DOWN", "ARROW_DOWN", "ARROW_DOWN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const cursor = rowIndexOf(frame, "▎ g home")
    const heading = rowIndexOf(frame, "Moving")
    expect(cursor).toBeGreaterThan(0)
    expect(heading).toBeGreaterThan(0)
    expect(heading).toBeLessThan(cursor)
  })
})

describe("when the terminal is wide", () => {
  test("then the palette stops at eighty columns and sits in the middle", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 200, height: 32, review: true })

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const title = rowWith(frame, "Commands")
    const left = title.indexOf("Commands")
    const count = title.search(/\d+(\s|$)/)
    expect(left).toBeGreaterThanOrEqual(60)
    expect(count).toBeGreaterThan(left)
    expect(count).toBeLessThanOrEqual(left + 74)
  })
})

describe("when the keys sheet opens", () => {
  test("then the title is one word with the count at the right edge", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "Keys")).toMatch(/^\s*Keys\s{4,}\d+/)
  })
})

describe("when the preferences open", () => {
  test("then each preference is one row that ends in on or off", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressKeys([","])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, "Wrap long lines")).toMatch(/off\s*$/)
    expect(rowWith(frame, "Keep the heading in view")).toMatch(/on\s*$/)
  })

  test("then what the highlighted preference does is said once, under the list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressKeys([","])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const said = rowsOf(frame).filter((row) => row.includes("Long lines wrap instead"))
    expect(said).toHaveLength(1)
    expect(rowIndexOf(frame, "Long lines wrap instead")).toBeGreaterThan(
      rowIndexOf(frame, "Keep the heading in view"),
    )
  })

  test("then the sheet sits at the bottom and the diff stays readable above it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressKeys([","])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("const one = 2")
    expect(rowIndexOf(frame, "Preferences")).toBeGreaterThan(rowIndexOf(frame, "const one = 2"))
    expect(rowIndexOf(frame, "toggle")).toBeGreaterThan(rowIndexOf(frame, "Open lines in"))
  })
})

describe("when the base picker opens", () => {
  test("then the title is one word and the line beneath names the branch and its base", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressKeys(["b"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const rows = rowsOf(frame)
    const title = rows.findIndex((row) => /\bBase\b/.test(row) && !row.includes("for "))
    expect(title).toBeGreaterThan(0)
    expect(rows[title + 1]).toContain("for ")
    expect(rows[title + 1]).toContain("now ")
  })
})

describe("when the search opens with nothing typed", () => {
  test("then one faint row says where the matches will list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewing(driver)

    // ACT
    await driver.screen.pressKeys(["/"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Search")
    expect(frame).toContain("Matches list here as you type")
  })
})
