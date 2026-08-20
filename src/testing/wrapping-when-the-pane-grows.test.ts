import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const long =
  "export type Options = { baseUrl: string; timeoutMs: number; retries: number; pageSize: number; backoffMs: number }"

const files = [{ path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", long] }]

const partsOf = (frame: string): number =>
  frame.split("\n").filter((line) => /baseUrl|timeoutMs|retries|pageSize|backoffMs/.test(line))
    .length

describe("when the pane grows", () => {
  test("then the diff wraps to the wider pane", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["w"])
    const before = partsOf(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(before).toBeGreaterThan(1)
    expect(partsOf(await driver.screen.getFrame())).toBeLessThan(before)
  })
})
