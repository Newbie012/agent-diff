import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const before = 1"],
  after: ["const before = 1", "const after = 2"],
})

const twoDirs = {
  files: [change("src/api/one.ts"), change("src/api/two.ts"), change("src/ui/panel.tsx")],
}

const wide = {
  files: Array.from({ length: 9 }, (_, index) => change(`src/many/file${index}.ts`)).concat([
    change("src/few/only.ts"),
  ]),
}

const pane = (frame: string): string =>
  frame
    .split("\n")
    .slice(2)
    .map((line) => line.slice(0, 38))
    .join("\n")

describe("folding away parts of the tree", () => {
  it("collapses the directory the current file lives in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoDirs)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const shown = pane(await driver.screen.getFrame())
    expect(shown).toContain("api")
    expect(shown).not.toContain("one.ts")
  })

  it("leaves other directories alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoDirs)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("panel.tsx")
  })

  it("opens it again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoDirs)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["h"])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("one.ts")
  })

  it("starts a crowded directory closed, so the tree opens readable", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wide)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const shown = pane(await driver.screen.getFrame())
    expect(shown).toContain("many")
    expect(shown).not.toContain("file3.ts")
    expect(shown).toContain("only.ts")
  })
})

describe("folding a directory that shows as one row", () => {
  it("hides the files under a chain-compressed directory", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [change("src/api/one.ts"), change("src/api/two.ts")],
    })
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const shown = pane(await driver.screen.getFrame())
    expect(shown).toContain("src/api")
    expect(shown).not.toContain("one.ts")
  })
})
