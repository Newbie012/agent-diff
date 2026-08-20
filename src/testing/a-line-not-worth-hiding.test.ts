import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = (mark: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `  const ${mark}${at} = ${at};`)

const apart = (gap: number) => ({
  files: [
    {
      path: "src/two-hunks.ts",
      before: ["export function held() {", ...body("keep", gap), "}"],
      after: ["export function held() {", "  const first = 1;", ...body("keep", gap), "  const last = 2;", "}"],
    },
  ],
}) 

const opened = async (driver: TestDriver, gap: number): Promise<string> => {
  await driver.branch.create(apart(gap))
  await driver.screen.open({ width: 120, height: 30, review: true })
  return driver.screen.getFrame()
}

describe("when a single line would be folded away", () => {
  test("then the line is shown instead of folded", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await opened(driver, 7)

    // ASSERT
    expect(frame).not.toContain("1 line hidden")
    expect(frame).not.toContain("1 lines hidden")
    expect(frame).toContain("const keep3")
  })

  test("then more than one line still folds", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await opened(driver, 20)

    // ASSERT
    expect(frame).toMatch(/⋯ \d+ lines hidden/)
    expect(frame).not.toContain("1 lines hidden")
  })
})
