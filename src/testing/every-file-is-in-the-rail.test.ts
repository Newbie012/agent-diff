import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

const railOf = (frame: string): string =>
  frame
    .split("\n")
    .map((line) => (line.split("│")[1] ?? ""))
    .join("\n")

const place = (frame: string): string =>
  (frame.split("\n")[0] ?? "").split(/\s{2,}/).find((part) => part.startsWith("file ")) ?? ""

describe("when the layers rail is drawn", () => {
  test("then a file no layer could order is still listed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.branch.setBinary(branch, "assets/logo.bin", 256)
    await driver.branch.commitAll(branch, "add a binary file")
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One layer over the code",
      layers: [
        {
          title: "The code",
          spans: [
            { path: "src/one.ts", start: 1, end: 2 },
            { path: "src/two.ts", start: 1, end: 2 },
          ],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ASSERT
    expect(railOf(await driver.screen.getFrame())).toContain("logo.bin")
  })

  test("then the rail counts the same files the walk visits", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.branch.setBinary(branch, "assets/logo.bin", 256)
    await driver.branch.commitAll(branch, "add a binary file")
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One layer over the code",
      layers: [{ title: "The code", spans: [{ path: "src/one.ts", start: 1, end: 2 }] }],
    })
    await driver.screen.open({ width: 150, height: 30, review: true })
    const started = place(await driver.screen.getFrame())

    // ACT
    const seen = new Set([started])
    await driver.screen.pressKeys(["]"])
    seen.add(place(await driver.screen.getFrame()))
    await driver.screen.pressKeys(["]"])
    seen.add(place(await driver.screen.getFrame()))

    // ASSERT
    expect(started).toContain("of 3")
    expect(seen.size).toBe(3)
  })
})
