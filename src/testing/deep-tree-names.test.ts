import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDTH = 157
const HEIGHT = 34

const change = (path: string) => ({
  path,
  before: ["const before = 1"],
  after: ["const before = 1", "const after = 2"],
})

const stages = "services/observability-platform/telemetry-ingestion/measurement-collectors"
const reducers = `${stages}/aggregation-pipelines/normalisation-stages/window-reducers`

const deep = {
  files: [
    change(`${reducers}/reduce-measurement-windows.ts`),
    change(`${reducers}/reduce-measurement-batches.ts`),
    change(`${stages}/aggregation-pipelines/summary-stages/summarise-measurement-windows.ts`),
    change(`${stages}/ingestion-receivers/http-measurement-receiver.ts`),
    change("services/observability-platform/README.md"),
  ],
}

const insideTheFrame = (frame: string): ReadonlyArray<string> => {
  const lines = frame.split("\n")
  const top = lines.findIndex((line) => line.includes("╭"))
  const bottom = lines.findIndex((line) => line.includes("╰"))
  return lines.slice(top + 1, bottom === -1 ? undefined : bottom)
}

const paneRows = (frame: string): ReadonlyArray<string> => {
  const rows = insideTheFrame(frame)
  const edge = Math.max(...rows.map((line) => line.indexOf("││")))
  return rows
    .map((line) => line.slice(0, edge === -1 ? undefined : edge).replaceAll("│", " ").trimEnd())
    .filter((line) => line.trim().length > 0)
}

const headerRow = (frame: string): string =>
  frame.split("\n").find((line) => line.trim().length > 0) ?? ""

const nameRows = (frame: string): ReadonlyArray<string> =>
  paneRows(frame)
    .filter((line) => line.includes(".ts"))
    .map((line) => line.trim().replace(/^[^\w]+/, ""))

const openDeepBranch = async (driver: TestDriver): Promise<string> => {
  await driver.branch.create(deep)
  await driver.screen.open({ width: WIDTH, height: HEIGHT })
  await driver.screen.pressKeys(["RETURN"])
  return driver.screen.getFrame()
}

describe("reading a file that sits deep in the tree", () => {
  it("draws two files whose names end the same way as two different rows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await openDeepBranch(driver)

    // ASSERT
    const names = nameRows(frame)
    expect(names.length).toBeGreaterThan(3)
    expect(new Set(names).size).toBe(names.length)
  })

  it("keeps the beginning of a name that says what the file does", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await openDeepBranch(driver)

    // ASSERT
    const names = nameRows(frame)
    expect(names.some((name) => name.startsWith("reduce"))).toBe(true)
    expect(names.some((name) => name.startsWith("summar"))).toBe(true)
    expect(names.every((name) => name.endsWith(".ts"))).toBe(true)
  })

  it("names the file the cursor is on in the header", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await openDeepBranch(driver)

    // ASSERT
    expect(headerRow(frame)).toContain("reduce-measurement-batches.ts")
  })

  it("marks the header path as shortened instead of letting it run off the edge", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await openDeepBranch(driver)

    // ASSERT
    const header = headerRow(frame)
    expect(header).toContain("…")
    expect(header.trimEnd().length).toBeLessThan(WIDTH)
    expect(header).toContain("2/5")
  })
})
