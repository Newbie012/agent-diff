import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const CORPUS = Array.from({ length: 40 }, (_, at) => `line ${at} mentions identity in prose`)

const world = {
  files: [
    {
      path: "src/graph.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "  const held = identity(nodeId);", "  return held ?? identity;"],
    },
    {
      path: "src/identity.ts",
      before: ["const b = 1"],
      after: ["const b = 1", "export function identity() {", "  return null", "}"],
    },
    {
      path: "src/other.ts",
      before: ["const c = 1"],
      after: ["const c = 1", "  return identity();"],
    },
    {
      path: "src/legacy.ts",
      before: ["const other = identity();"],
      after: ["const other = identity();"],
    },
    {
      path: "src/borrow.ts",
      before: ["import type { Held } from './identity'", "const kept = 1"],
      after: ["import type { Held } from './identity'", "const kept = 1"],
    },
    {
      path: "src/graph.spec.ts",
      before: ["expect(identity()).toBe(1)"],
      after: ["expect(identity()).toBe(1)"],
    },
    {
      path: "src/zoom.spec.ts",
      before: ["const start = 1"],
      after: ["const start = 1", "expect(identity()).toBe(2)"],
    },
    {
      path: "src/zfields.ts",
      before: ["class Held {", "}"],
      after: ["class Held {", "  private readonly identity: string;", "}"],
    },
    {
      path: "docs/notes.md",
      before: ["The type identity of a program is the key it groups under."],
      after: ["The type identity of a program is the key it groups under."],
    },
    {
      path: ".github/workflows/build.yml",
      before: ["      - run: deploy --service identity"],
      after: ["      - run: deploy --service identity"],
    },
    {
      path: "apps/api/Dockerfile.fips",
      before: ["COPY apps/identity/package.json ./"],
      after: ["COPY apps/identity/package.json ./"],
    },
    {
      path: "fixtures/corpus.txt",
      before: CORPUS,
      after: CORPUS,
    },
  ],
}

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const rowAt = (frame: string, text: string): number =>
  rowsOf(frame).findIndex((row, at) => at > 0 && row.includes(text))

const searching = async (driver: TestDriver) => {
  await driver.branch.create(world)
  await driver.screen.open({ width: 150, height: 60, review: true })
  await driver.screen.pressKeys(["/"])
  await driver.screen.typeText("identity")
  await driver.screen.pressKeys(["RETURN"])
}

describe("when a name is searched for across a worktree", () => {
  test("then the file on screen is listed first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowAt(frame, "src/graph.ts")).toBeGreaterThan(0)
    expect(rowAt(frame, "src/graph.ts")).toBeLessThan(rowAt(frame, "src/identity.ts"))
  })

  test("then the file that declares the name comes before another file the branch changes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowAt(frame, "src/identity.ts")).toBeGreaterThan(0)
    expect(rowAt(frame, "src/identity.ts")).toBeLessThan(rowAt(frame, "src/other.ts"))
  })

  test("then the row that declares the name says it is the declaration", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("declared")
  })

  test("then the files the branch changes are listed before the rest of the worktree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowAt(frame, "src/graph.ts")).toBeLessThan(rowAt(frame, "src/legacy.ts"))
  })

  test("then a test comes after the code and captured text comes last", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowAt(frame, "src/legacy.ts")).toBeLessThan(rowAt(frame, "src/graph.spec.ts"))
    expect(rowAt(frame, "src/graph.spec.ts")).toBeLessThan(rowAt(frame, "fixtures/corpus.txt"))
  })

  test("then a test the branch changes comes before a test it leaves alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowAt(frame, "src/zoom.spec.ts")).toBeGreaterThan(0)
    expect(rowAt(frame, "src/zoom.spec.ts")).toBeLessThan(rowAt(frame, "src/graph.spec.ts"))
  })

  test("then a line that borrows the name from elsewhere is not called a declaration", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const rows = rowsOf(await driver.screen.getFrame())
    const at = rows.findIndex((row, index) => index > 0 && row.includes("src/borrow.ts"))
    expect(at).toBeGreaterThan(0)
    expect(rows[at]).not.toContain("declared")
  })

  test("then a sentence in a document is not called a declaration, and the document comes after the code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const rows = rowsOf(await driver.screen.getFrame())
    const at = rows.findIndex((row, index) => index > 0 && row.includes("docs/notes.md"))
    expect(at).toBeGreaterThan(0)
    expect(rows[at]).not.toContain("declared")
    expect(at).toBeGreaterThan(rowAt(await driver.screen.getFrame(), "src/legacy.ts"))
  })

  test("then a workflow file and a Dockerfile come after the code that changed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowAt(frame, "src/legacy.ts")).toBeLessThan(rowAt(frame, "workflows/build.yml"))
    expect(rowAt(frame, "src/legacy.ts")).toBeLessThan(rowAt(frame, "Dockerfile.fips"))
  })

  test("then a field declared with a modifier says it is the declaration", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const rows = rowsOf(await driver.screen.getFrame())
    const at = rows.findIndex((row, index) => index > 0 && row.includes("src/zfields.ts"))
    expect(at).toBeGreaterThan(0)
    expect(rows[at]).toContain("declared")
  })

  test("then the count for each distance is said", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("2 in this file")
    expect(frame).toContain("6 on this branch")
    expect(frame).toContain("52 in the worktree")
  })
})

const MANY = Array.from({ length: 25 }, (_, at) => `  const held${at} = identity(${at});`)

describe("when one file holds more places than the list will show", () => {
  test("then the list says how many places it did not show", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [{ path: "src/many.ts", before: ["const a = 1"], after: ["const a = 1", ...MANY] }],
    })
    await driver.screen.open({ width: 150, height: 44, review: true })

    // ACT
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText("identity")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("5 more places not shown")
  })
})
