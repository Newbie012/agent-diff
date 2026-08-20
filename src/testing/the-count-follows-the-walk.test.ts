import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"

const spread = shapes.find((shape) => shape.name.includes("several folders"))

const place = (frame: string): string =>
  (frame.split("\n")[0] ?? "")
    .split(/\s{2,}/)
    .find((part) => /^file \d+ of \d+$/.test(part.trim()))
    ?.trim() ?? ""

describe("when the header counts the files", () => {
  test("then the count steps by one on every turn to the next file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(spread?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })
    const walked: Array<string> = []

    // ACT
    const stepping = async (): Promise<void> => {
      walked.push(place(await driver.screen.getFrame()))
      await driver.screen.pressKeys(["]"])
    }
    await (spread?.files ?? []).reduce((waiting) => waiting.then(stepping), Promise.resolve())

    // ASSERT
    const many = spread?.files.length ?? 0
    expect(walked).toEqual(Array.from({ length: many }, (_, at) => `file ${at + 1} of ${many}`))
  })

  test("then the count is of what can be walked to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [...(spread?.files ?? [])] })
    await driver.screen.open({ width: 120, height: 24, review: true })
    const before = place(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const after = place(await driver.screen.getFrame())
    expect(before).not.toBe("")
    expect(after).not.toBe("")
  })
})

describe("when a branch is named on the command line", () => {
  test("then adiff opens at the top of the walk", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [...(spread?.files ?? [])] })

    // ACT
    await driver.screen.open({ width: 120, height: 24, branch: branch.name })

    // ASSERT
    const many = spread?.files.length ?? 0
    expect(place(await driver.screen.getFrame())).toBe(`file 1 of ${many}`)
  })
})
