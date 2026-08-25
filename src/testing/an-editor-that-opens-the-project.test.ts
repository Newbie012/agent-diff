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

const said = (driver: TestDriver): string => join(driver.workspacePath, "opened.txt")

const wrote = async (driver: TestDriver): Promise<string> => {
  const path = said(driver)
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

describe("when a line opens in an editor that reads a whole project", () => {
  test("then the editor is handed the branch's folder as well as the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.scriptOnPath("code", `printf '%s' "$*" > ${said(driver)}`)
    await driver.screen.open({ width: 150, height: 30, review: true, withoutEditor: true })
    await driver.screen.pressKeys(["j", "e"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const args = (await wrote(driver)).split(" ")
    expect(args).toContain(branch.worktree)
    expect(args.join(" ")).toContain("src/api.ts:2")
  })

  test("then an editor of its own runs in the branch's folder", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.editorIs(`${join(driver.workspacePath, "bin", "here")} {file}`)
    await driver.app.scriptOnPath("here", `printf '%s' "$PWD" > ${said(driver)}`)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["j", "e"])

    // ASSERT
    expect(await wrote(driver)).toContain(branch.worktree)
  })
})

describe("when a reviewer has an editor command of their own", () => {
  test("then the list offers the command they typed as the command to keep", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true, withoutEditor: true })
    await driver.screen.pressKeys(["e"])

    // ACT
    await driver.screen.typeText("mine --at {file}:{line}")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("mine --at {file}:{line}")
    expect(frame).toContain("the command you typed")
  })
})
