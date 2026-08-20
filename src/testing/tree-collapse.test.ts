import { describe, expect, test } from "@effect/vitest"
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

describe("when parts of the tree are folded away", () => {
  test("then the directory the current file lives in collapses", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoDirs)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const shown = pane(await driver.screen.getFrame())
    expect(shown).toContain("api")
    expect(shown).not.toContain("one.ts")
  })

  test("then the other directories are left alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoDirs)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("panel.tsx")
  })

  test("then the directory opens again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoDirs)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["h"])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("one.ts")
  })

  test("then a crowded directory starts closed", async () => {
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

describe("when a chain-compressed directory is folded", () => {
  test("then the files under it are hidden", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [change("src/api/one.ts"), change("src/api/two.ts")],
    })
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const shown = pane(await driver.screen.getFrame())
    expect(shown).toContain("src/api")
    expect(shown).not.toContain("one.ts")
  })
})
