import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "../../index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const rowIndexOf = (frame: string, text: string): number =>
  rowsOf(frame).findIndex((row) => row.includes(text))

const withFakeCode = async (driver: TestDriver): Promise<string> => {
  await driver.branch.create({ files })
  const said = join(driver.workspacePath, "opened.txt")
  await driver.app.scriptOnPath("code", `printf '%s' "$*" > ${said}`)
  await driver.screen.open({ width: 130, height: 32, review: true, withoutEditor: true })
  return said
}

const onTheEditorRow = async (driver: TestDriver): Promise<void> => {
  await driver.screen.pressKeys([","])
  await driver.screen.pressKeys(["j", "j", "j", "j", "j", "j", "j", "j"])
}

describe("when the preferences open", () => {
  test("then the editor a line opens in is the last row of the sheet", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)

    // ACT
    await driver.screen.pressKeys([","])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowIndexOf(frame, "Open lines in")).toBeGreaterThan(
      rowIndexOf(frame, "Hold comments until you send them"),
    )
  })
})

describe("when return is pressed on the editor row", () => {
  test("then the editors on the machine are offered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)
    await onTheEditorRow(driver)

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Editor")
    expect(frame).toContain("code")
  })

  test("then the picker asks for a command, not a branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)
    await onTheEditorRow(driver)

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Type the command that opens a file")
  })

  test("then escape twice leaves the picker, then the sheet, and lands on the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)
    await onTheEditorRow(driver)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressEscape()
    const sheet = await driver.screen.getFrame()
    await driver.screen.pressEscape()

    // ASSERT
    expect(sheet).toContain("Preferences")
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Preferences")
    expect(frame).toContain("const one = 2")
  })

  test("then choosing one comes back to the sheet with the choice on its row, and opens no line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const said = await withFakeCode(driver)
    await onTheEditorRow(driver)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Preferences")
    expect(rowsOf(frame).find((row) => row.includes("Open lines in"))).toContain("code")
    await driver.screen.waited(300)
    expect(await readFile(said, "utf8").catch(() => "")).toBe("")
  })
})
