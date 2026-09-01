import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    { path: "src/api.ts", before: [], after: ["const first = 1", "const second = 2"] },
    { path: "src/web.ts", before: [], after: ["const third = 3", "const fourth = 4"] },
  ],
}

const withTwoThreads = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create(twoFiles)
  await driver.app.runComment({
    branch: branch.name,
    file: "src/api.ts",
    start: 1,
    end: 1,
    body: "the first point",
  })
  await driver.app.runComment({
    branch: branch.name,
    file: "src/api.ts",
    start: 2,
    end: 2,
    body: "the second point",
  })
  await driver.screen.open({ width: 150, height: 30, review: true })
}

describe("when the reviewer marks a file that still holds open threads", () => {
  test("then a box counts the threads on the file and offers to settle them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withTwoThreads(driver)

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api.ts still holds 2 open threads")
    expect(frame).toContain("Settle them and mark the file read")
    expect(frame).toContain("Mark the file read and leave them open")
  })

  test("then settling from the box marks the file read and closes both threads", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withTwoThreads(driver)
    await driver.screen.pressKeys(["m"])

    // ACT
    await driver.screen.pressKeys(["return"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("marked src/api.ts and settled 2 threads")
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["f"])
    const hidden = await driver.screen.getFrame()
    expect(hidden).not.toContain("the first point")
    expect(hidden).not.toContain("the second point")
  })

  test("then marking the file read leaves both threads open", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withTwoThreads(driver)
    await driver.screen.pressKeys(["m"])

    // ACT
    await driver.screen.pressKeys(["j", "return"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("marked src/api.ts")
    expect(frame).not.toContain("settled")
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["f"])
    expect(await driver.screen.getFrame()).toContain("the first point")
  })

  test("then escape marks nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withTwoThreads(driver)
    await driver.screen.pressKeys(["m"])

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("still holds 2 open threads")
    expect(frame).not.toContain("✓")
  })
})

describe("when the reviewer marks a file with nothing open on it", () => {
  test("then the file is marked read without a box", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withTwoThreads(driver)
    await driver.screen.pressKeys(["]"])

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("marked src/web.ts")
    expect(frame).not.toContain("still holds")
  })
})

const lines = (from: number, to: number): ReadonlyArray<string> =>
  Array.from({ length: to - from + 1 }, (_, at) => `  const step${from + at} = ${from + at}`)

const spread = {
  files: [
    {
      path: "src/run.ts",
      before: ["export const run = () => {", ...lines(2, 20), "}"],
      after: [
        "export const run = () => {",
        ...lines(2, 4),
        "  const one = 'first layer'",
        ...lines(6, 14),
        "  const two = 'second layer'",
        ...lines(16, 20),
        "}",
      ],
    },
  ],
}

const twoLayers = {
  summary: "One file, two layers",
  layers: [
    { title: "The first change", spans: [{ path: "src/run.ts", start: 5, end: 5 }] },
    { title: "The second change", spans: [{ path: "src/run.ts", start: 15, end: 15 }] },
  ],
}

describe("when the reviewer marks one layer of a file", () => {
  test("then the box counts only the threads inside that layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(spread)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/run.ts",
      start: 5,
      end: 5,
      body: "the point in the first layer",
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/run.ts",
      start: 15,
      end: 15,
      body: "the point in the second layer",
    })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/run.ts still holds 1 open thread")
  })
})
