import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const edited = {
  path: "src/one.ts",
  before: ["const a = 1"],
  after: ["const a = 1", "const b = 2"],
}

const kept = [
  "export function widget() {",
  "  const first = 1",
  "  const second = 2",
  "  return first + second",
  "}",
]

const untouched = { path: "pkg/widget.ts", before: kept, after: kept }

describe("a file whose lines did not change", () => {
  it("says the mode changed instead of drawing a bare line number", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [edited, untouched] })
    await driver.branch.makeExecutable(branch, "pkg/widget.ts")

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("mode changed, 100644 to 100755")
  })

  it("says where a renamed file came from", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [edited, untouched] })
    await driver.branch.rename(branch, "pkg/widget.ts", "pkg/renamed.ts")

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("renamed from pkg/widget.ts")
  })
})

describe("an empty file that was added", () => {
  it("says so, instead of drawing a bare line number", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [edited] })
    await driver.branch.setRaw(branch, "pkg/blank.ts", "")
    await driver.branch.commitAll(branch, "add an empty file")

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("added an empty file")
  })
})

describe("a file that was renamed and edited", () => {
  it("says where it came from and still shows the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [edited, untouched] })
    await driver.branch.rename(branch, "pkg/widget.ts", "pkg/renamed.ts")
    await driver.branch.setFile(branch, "pkg/renamed.ts", kept.map((line) => (line.includes("second") ? "  const second = 3" : line)))

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("renamed from pkg/widget.ts")
    expect(frame).toContain("const second = 3")
  })
})
