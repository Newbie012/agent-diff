import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: [`const ${path.split("/").at(-1)?.split(".")[0]} = 1`],
  after: [`const ${path.split("/").at(-1)?.split(".")[0]} = 1`, "const added = 2"],
})

const nested = {
  files: [
    change("src/api/incidents.ts"),
    change("src/api/errors.ts"),
    change("src/ui/Panel.tsx"),
    change("README.md"),
  ],
}

const paneOf = (frame: string): string => {
  const lines = frame.split("\n")
  const top = lines.findIndex((line) => line.includes("╭"))
  const bottom = lines.findIndex((line) => line.includes("╰"))
  return lines
    .slice(top + 1, bottom === -1 ? undefined : bottom)
    .map((line) => line.slice(0, 32))
    .join("\n")
}

describe("when the files of a branch are navigated", () => {
  test("then the changed files are grouped under the directories they live in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("src")
    expect(pane).toContain("api")
    expect(pane).toContain("incidents.ts")
    expect(pane).toContain("README.md")
    expect(pane).not.toContain("src/api/incidents.ts")
  })

  test("then collapsing a directory stops its files taking room", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("api")
    expect(pane).not.toContain("incidents.ts")
  })

  test("then a directory leading to one place folds into a single row", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [change("src/api/v2/incidents.ts"), change("src/api/v2/errors.ts")],
    })
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("src/api/v2")
    expect(pane).toContain("errors.ts")
  })

  test("then the file the cursor lands on opens", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["]"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api/incidents.ts")
  })
})
