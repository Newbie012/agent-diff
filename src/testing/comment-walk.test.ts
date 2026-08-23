import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const spread = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", ...Array.from({ length: 30 }, (_, at) => `const layer${at} = ${at}`)],
    },
    {
      path: "src/other.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const late = 1"],
    },
  ],
}

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

describe("when the reviewer walks between comments", () => {
  test("then the cursor jumps to the line the next comment sits on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j", "j", "j", "j", "j"])
    await driver.screen.writeComment("look at this")
    await driver.screen.pressKeys(["g"])

    // ACT
    await driver.screen.pressKeys(["n"])

    // ASSERT
    expect(await driver.screen.rowWith("const layer4 = 4")).toContain("▎")
  })

  test("then the cursor jumps back to the comment above", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j", "j"])
    await driver.screen.writeComment("the early one")
    await driver.screen.pressKeys(["G"])

    // ACT
    await driver.screen.pressKeys(["N"])

    // ASSERT
    expect(await driver.screen.rowWith("const layer1 = 1")).toContain("▎")
  })

  test("then walking carries on into the next file with a comment", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("over here")
    await driver.screen.pressKeys(["["])

    // ACT
    await driver.screen.pressKeys(["n"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/other.ts")
    expect(rowWith(frame, "over here")).not.toHaveLength(0)
  })

  test("then the footer reports nothing to walk to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["n"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing waiting on you here")
  })
})
