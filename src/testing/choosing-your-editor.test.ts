import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { series } from "./state.ts"

const files = [
  {
    path: "src/api.ts",
    before: ["const keep = 0"],
    after: ["const keep = 0", "const first = 1"],
  },
]

const opened = async (driver: TestDriver): Promise<string> => {
  const path = join(driver.workspacePath, "opened.txt")
  let held = ""
  await series(
    Array.from({ length: 20 }, (_, at) => at),
    async () => {
      if (held.length > 0) return
      await driver.screen.waited(100)
      held = await readFile(path, "utf8").catch(() => "")
    },
  )
  return held
}

const withFakeCode = async (driver: TestDriver) => {
  await driver.branch.create({ files })
  const said = join(driver.workspacePath, "opened.txt")
  await driver.app.scriptOnPath("code", `printf '%s' "$*" > ${said}`)
  await driver.screen.open({ width: 150, height: 30, review: true, withoutEditor: true })
}

describe("when a reviewer has no editor and asks to open a line", () => {
  test("then the editors on their machine are offered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)

    // ACT
    await driver.screen.pressKeys(["e"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Editor")
    expect(frame).toContain("code")
  })

  test("then choosing one opens the line straight away", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)
    await driver.screen.pressKeys(["j", "e"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await opened(driver)).toContain("src/api.ts:2")
  })

  test("then the choice is kept for the next line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)
    await driver.screen.pressKeys(["j", "e"])
    await driver.screen.pressKeys(["RETURN"])
    expect(await opened(driver)).toContain("src/api.ts:2")

    // ACT
    await driver.screen.pressKeys(["e"])

    // ASSERT
    expect(await driver.screen.untilShown("src/api.ts:2 in")).toBe(true)
    expect(await driver.screen.getFrame()).not.toContain("Editor  ·")
  })
})

describe("when a reviewer wants a different editor", () => {
  test("then the list says which one is in use, and one key hands the choice back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withFakeCode(driver)
    await driver.app.editorIs("code --goto {file}:{line}")

    // ACT
    await driver.screen.pressKeys(["E"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("now code --goto")

    // ACT
    await driver.screen.pressCtrl("x")

    // ASSERT
    expect(await driver.screen.untilShown("the editor is the environment's again")).toBe(true)
  })
})
