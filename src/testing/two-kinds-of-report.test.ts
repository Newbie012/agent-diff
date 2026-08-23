import { chmod, readdir, readFile } from "node:fs/promises"
import { hostname } from "node:os"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Reported = {
  readonly text: string
  readonly branch: string
  readonly repo: string
}

const oneFile = {
  files: [
    {
      path: "src/secret-name.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
}

const reported = async (driver: TestDriver, minimal: boolean): Promise<Reported> => {
  const branch = await driver.branch.create(oneFile)
  await driver.screen.open({ review: true })
  await driver.screen.pressKeys(["j"])
  await driver.screen.pressKeys(["n"])
  await driver.screen.pressCtrl("b")
  await driver.screen.typeText("something went wrong")
  if (minimal) await driver.screen.pressCtrl("t")
  await driver.screen.pressCtrl("s")
  const dir = join(driver.storeRoot, "reports")
  const found = (await readdir(dir)).toSorted()
  return {
    text: await readFile(join(dir, found.at(-1) ?? ""), "utf8"),
    branch: branch.name,
    repo: await driver.branch.ownPath(),
  }
}

describe("when a bug is reported", () => {
  test("then the report carries the notices the reviewer was shown, with the clock", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const { text } = await reported(driver, false)

    // ASSERT
    expect(text).toMatch(/\d+:\d\d\s+said\s+\S/)
  })

  test("then the report sends everything on screen by default", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const { text } = await reported(driver, false)

    // ASSERT
    expect(text).toContain("What led here")
    expect(text).toContain("secret-name.ts")
  })

  test("then a minimal report sends no file names or code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const { text } = await reported(driver, true)

    // ASSERT
    expect(text).toContain("something went wrong")
    expect(text).not.toContain("What led here")
    expect(text).not.toContain("const b = 2")
  })

  test("then a minimal report names no machine, repository, branch or file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const { text, branch, repo } = await reported(driver, true)

    // ASSERT
    expect(text).not.toContain(hostname())
    expect(text).not.toContain(repo)
    expect(text).not.toContain(branch)
    expect(text).not.toContain("secret-name.ts")
  })

  test("then a full report still names the machine, the repository, the branch and the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const { text, branch, repo } = await reported(driver, false)

    // ASSERT
    expect(text).toContain(hostname())
    expect(text).toContain(repo)
    expect(text).toContain(branch)
    expect(text).toContain("secret-name.ts")
  })

  test("then a minimal report written after a failure names the kind and no path", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.agent.setStoreFile(branch.worktree, "state.json", '{"vouches":{}}')
    await driver.screen.open({ review: true })
    const filed = await readdir(join(driver.storeRoot, "branches"))
    await chmod(join(driver.storeRoot, "branches", filed[0] ?? "", "state.json"), 0o000)
    await driver.screen.pressKeys(["m"])

    // ACT
    await driver.screen.pressCtrl("b")
    await driver.screen.typeText("marking a file threw")
    await driver.screen.pressCtrl("t")
    await driver.screen.pressCtrl("s")
    const dir = join(driver.storeRoot, "reports")
    const found = (await readdir(dir)).toSorted()
    const text = await readFile(join(dir, found.at(-1) ?? ""), "utf8")

    // ASSERT
    const said = text.split("\n").find((line) => line.startsWith("- last internal failure:"))
    expect(said).toBe("- last internal failure: StoreUnwritable")
    expect(text).not.toContain(driver.storeRoot)
    expect(text).not.toContain(await driver.branch.ownPath())
  })
})
