import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const longFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", ...Array.from({ length: 80 }, (_, at) => `const line${at + 1} = ${at}`)],
    },
  ],
}

const topLineOf = (frame: string): string => {
  for (const row of frame.split("\n")) {
    const found = /(\d+)\s*\+\s*const line/.exec(row)
    if (found?.[1] !== undefined) return found[1]
  }
  return ""
}

describe("when the branch is read again", () => {
  test("then the reader is left looking at the same lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(longFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(Array.from({ length: 30 }, () => "j"))
    const before = topLineOf(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(before).not.toBe("")
    expect(topLineOf(await driver.screen.getFrame())).toBe(before)
  })
})
