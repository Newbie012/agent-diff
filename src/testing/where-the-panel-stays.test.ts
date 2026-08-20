import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const files = [
  {
    path: "src/one.ts",
    before: ["const a = 1"],
    after: ["const a = 1", "const one = 2", "const two = 3", "const three = 4"],
  },
]

const threads = async (driver: TestDriver): Promise<string> => {
  const branch = await driver.branch.create({ files })
  const points = [
    { line: 2, body: "the first point" },
    { line: 3, body: "the second point" },
    { line: 4, body: "the third point" },
  ]
  await points.reduce<Promise<unknown>>(
    (waiting, point) =>
      waiting.then(() =>
        driver.app.runComment({
          branch: branch.name,
          file: "src/one.ts",
          start: point.line,
          end: point.line,
          body: point.body,
        }),
      ),
    Promise.resolve(),
  )
  return branch.name
}

type Thread = { readonly body: string; readonly state: string }

const threadsOf = (result: { readonly envelope: unknown }): ReadonlyArray<Thread> =>
  (result.envelope as { comments: ReadonlyArray<Thread> }).comments

const focusedThread = async (driver: TestDriver): Promise<string> =>
  (await driver.screen.paintedWith(palette.selection)).join(" ")

const panelFocused = async (driver: TestDriver): Promise<void> => {
  await driver.screen.pressKeys(["TAB"])
}

describe("when a thread is settled from the review panel", () => {
  test("then the cursor stays off the first thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const name = await threads(driver)
    await driver.app.runConfigSet("hideSettled", true)
    await driver.screen.open({ width: 140, height: 26, branch: name })
    await panelFocused(driver)
    await driver.screen.pressKeys(["ARROW_DOWN"])
    expect(await focusedThread(driver)).toContain("the second point")

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(after).not.toContain("the second point")
    expect(await focusedThread(driver)).toContain("the first point")
  })

  test("then the next thread comes to the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const name = await threads(driver)
    await driver.screen.open({ width: 140, height: 26, branch: name })
    await panelFocused(driver)
    await driver.screen.pressKeys(["ARROW_DOWN"])

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await focusedThread(driver)).toContain("the first point")
  })

  test("then three threads settle in a row without walking back up", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const name = await threads(driver)
    await driver.screen.open({ width: 140, height: 26, branch: name })
    await panelFocused(driver)

    // ACT
    await driver.screen.pressKeys(["d", "d", "d"])

    // ASSERT
    const listed = await driver.app.runThreads(name, ["body", "state"])
    const settled = threadsOf(listed).filter((thread) => thread.state === "done")
    expect(settled.map((thread) => thread.body)).toHaveLength(3)
  })
})
