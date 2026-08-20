import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const change = (path: string, name: string) => ({
  path,
  before: [`const ${name} = 1`],
  after: [`const ${name} = 1`, `const ${name}Added = 2`],
})

const threeFiles = {
  files: [
    change("src/model.ts", "model"),
    change("src/api.ts", "api"),
    change("src/ui/Panel.tsx", "panel"),
  ],
}

const layers: LayersInput = {
  summary: "Invitations, end to end",
  layers: [
    {
      title: "Add the invitation data model",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
    {
      title: "Add the invitation API",
      spans: [{ path: "src/api.ts", start: 1, end: 2 }],
    },
  ],
}

const noted: LayersInput = {
  summary: "Invitations, end to end",
  layers: [
    {
      title: "Let a rule write carry the team id through the queue",
      note: "The queue dropped the team id, so support could not tell which team ran out of seats.",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
    {
      title: "Give each endpoint its own error",
      spans: [{ path: "src/api.ts", start: 1, end: 2 }],
    },
  ],
}

const railRows = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => (line.split("│")[1] ?? "").trimEnd())

const paneOf = (frame: string): string => railRows(frame).join("\n")

describe("when a review is walked by the layers rail", () => {
  test("then the rail lists the layers, numbered and counted, in place of the file tree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runLayersSet(branch.worktree, layers)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("1 Add the invitation")
    expect(pane).toContain("2 Add the invitation")
    expect(pane.indexOf("Panel.tsx")).toBeGreaterThan(pane.indexOf("not in any layer"))
  })

  test("then the files no layer claims sit in a group of their own", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runLayersSet(branch.worktree, layers)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(paneOf(await driver.screen.getFrame())).toContain("not in any layer")
  })

  test("then the diff is scoped to the layer under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runLayersSet(branch.worktree, layers)
    await driver.screen.open({ review: true })
    expect(await driver.screen.getFrame()).toContain("src/model.ts")

    // ACT
    await driver.screen.pressKeys(["TAB", "j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api.ts")
    expect(frame).toContain("apiAdded")
    expect(frame).not.toContain("modelAdded")
  })

  test("then the file tree comes back when asked for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runLayersSet(branch.worktree, layers)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["s"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("Panel.tsx")
    expect(pane).not.toContain("1 Add the invitation")
  })

  test("then a title too long for the rail wraps", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runLayersSet(branch.worktree, noted)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rail = paneOf(await driver.screen.getFrame())
    expect(rail).toContain("Let a rule write")
    expect(rail).toContain("queue")
    expect(rail).not.toContain("…")
  })

  test("then a layer's files list under the directory they share and fold away", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runLayersSet(branch.worktree, noted)
    await driver.screen.open({ review: true })

    // ASSERT
    const open = paneOf(await driver.screen.getFrame())
    expect(open).toContain("src/")
    expect(open).toContain("model.ts")

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    expect(paneOf(await driver.screen.getFrame())).not.toContain("model.ts")
  })

  test("then a layer's note stays out of the rail", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(threeFiles)
    await driver.app.runLayersSet(branch.worktree, noted)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(paneOf(frame)).not.toContain("dropped")
    expect(frame).toContain("dropped")
  })

  test("then a branch with no layers shows the file tree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const pane = paneOf(await driver.screen.getFrame())
    expect(pane).toContain("Panel.tsx")
    expect(pane).not.toContain("not in any layer")
  })
})
