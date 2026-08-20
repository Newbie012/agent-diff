import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const three = {
  files: [
    { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/two.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
    { path: "src/three.ts", before: ["const e = 5"], after: ["const e = 5", "const f = 6"] },
  ],
}

const pane = (frame: string): string => {
  const lines = frame.split("\n")
  const top = lines.findIndex((line) => line.includes("╭"))
  const bottom = lines.findIndex((line) => line.includes("╰"))
  return lines
    .slice(top + 1, bottom === -1 ? undefined : bottom)
    .map((line) => line.slice(0, 34))
    .join("\n")
}

const reviewedOne = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(three)
  await driver.screen.open({ width: 120, height: 20, review: true })
  await driver.screen.pressKeys(["m"])
  await driver.screen.pressKeys(["]"])
}

describe("when the files already read are hidden", () => {
  test("then every file stays until hiding is asked for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await reviewedOne(driver)

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("one.ts")
  })

  test("then a reviewed file drops out of the list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewedOne(driver)

    // ACT
    await driver.screen.pressKeys(["f"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).not.toContain("one.ts")
  })

  test("then the file the cursor is on stays even once read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(three)
    await driver.screen.open({ width: 120, height: 20, review: true })
    await driver.screen.pressKeys(["f"])

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("one.ts")
  })

  test("then asking again brings the hidden files back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reviewedOne(driver)
    await driver.screen.pressKeys(["f"])

    // ACT
    await driver.screen.pressKeys(["f"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("one.ts")
  })
})
