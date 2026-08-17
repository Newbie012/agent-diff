import { describe, expect, it } from "@effect/vitest"
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

describe("navigating the files of a branch", () => {
  it("groups the changed files under the directories they live in", async () => {
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

  it("collapses a directory so its files stop taking room", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("api")
    expect(pane).not.toContain("incidents.ts")
  })

  it("folds a directory that only leads to one place into a single row", async () => {
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

  it("opens the file the cursor lands on, so moving down reads the branch in order", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["]"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api/incidents.ts")
  })
})
