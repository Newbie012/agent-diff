import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = (mark: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `  const ${mark}${at} = ${at};`)

const buried = {
  files: [
    {
      path: "src/deep.ts",
      before: ["export function held() {", ...body("step", 60), "}"],
      after: ["export function held() {", ...body("step", 60), "  const added = 1;", "}"],
    },
    {
      path: "src/other.ts",
      before: ["export function beside() {", ...body("kept", 60), "}"],
      after: ["export function beside() {", ...body("kept", 60), "  const also = 1;", "}"],
    },
  ],
}

describe("opening the lines a diff is hiding", () => {
  it("reads the file it is opening, not every file on the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN", "g"])
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.pressKeys(["k", "l"])

    // ASSERT
    const asked = driver.screen.diffsAsked()
    expect(asked).toHaveLength(1)
    expect(asked[0]?.only).toBe("src/deep.ts")
    expect(await driver.screen.getFrame()).toContain("const step")
  })
})
