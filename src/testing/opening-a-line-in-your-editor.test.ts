import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { series } from "./state.ts"

const files = [
  {
    path: "src/api.ts",
    before: ["const keep = 0"],
    after: ["const keep = 0", "const first = 1", "const second = 2"],
  },
]

const wrote = async (driver: TestDriver): Promise<string> => {
  const path = join(driver.workspacePath, "opened.txt")
  const tries = Array.from({ length: 20 }, (_, at) => at)
  let held = ""
  await series(tries, async () => {
    if (held.length > 0) return
    await driver.screen.waited(100)
    held = await readFile(path, "utf8").catch(() => "")
  })
  return held
}

describe("when a reviewer opens the line under the cursor in their editor", () => {
  test("then the editor is handed the file and the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    const said = join(driver.workspacePath, "opened.txt")
    await driver.app.editorIs(`${join(driver.workspacePath, "bin", "say")} ${said} {file}:{line}`)
    await driver.app.scriptOnPath("say", `printf '%s' "$2" > "$1"`)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["j", "e"])

    // ASSERT
    expect(await driver.screen.untilShown("src/api.ts:2 in")).toBe(true)
    expect(await wrote(driver)).toContain("src/api.ts:2")
  })

  test("then a reviewer with no editor set is offered the choice rather than a notice", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true, withoutEditor: true })

    // ACT
    await driver.screen.pressKeys(["e"])

    // ASSERT
    expect(await driver.screen.untilShown("Editor")).toBe(true)
  })

  test("then a command the reviewer types is the one that opens the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    const said = join(driver.workspacePath, "opened.txt")
    await driver.app.scriptOnPath("mine", `printf '%s' "$*" > ${said}`)
    await driver.screen.open({ width: 150, height: 30, review: true, withoutEditor: true })
    await driver.screen.pressKeys(["j", "e"])

    // ACT
    await driver.screen.typeText("mine {file}:{line}")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await wrote(driver)).toContain("src/api.ts:2")
  })
})
