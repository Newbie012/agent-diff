import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { shapes } from "./shapes.ts"

const spread = shapes.find((shape) => shape.name.includes("several folders"))

const place = (frame: string): string =>
  (frame.split("\n")[0] ?? "")
    .split(/\s{2,}/)
    .find((part) => /^file \d+ of \d+$/.test(part.trim()))
    ?.trim() ?? ""

describe("the count in the header", () => {
  it("steps by one every time the reviewer turns to the next file", async () => {
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

  it("counts what can be walked to, not what is folded away", async () => {
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

describe("where a branch named on the command line opens", () => {
  it("opens at the top of the walk, not wherever git listed first", async () => {
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
