import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const before = ["export class Exporter {", "}"]

const after = [
  "export class Exporter {",
  "  /**",
  "   * Turns a chart into a file.",
  "   */",
  "  static async draw() {",
  "    return 1",
  "  }",
  "",
  "  /**",
  "   * Measures the picture once.",
  "   */",
  "  private async write() {",
  "    return 2",
  "  }",
  "}",
]

const fixed = after.filter((line) => line !== "   * Turns a chart into a file." && line !== "  /**")

const files = [{ path: "src/exporter.ts", before, after }]

describe("when the agent deletes the lines a comment was written on", () => {
  test("then the comment is not hung on a line that merely looks the same", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/exporter.ts",
      start: 2,
      end: 4,
      body: "this doc comment hints the name is unclear",
    })
    await driver.branch.setFile(branch, "src/exporter.ts", fixed)

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("The branch moved past")
    expect(frame).not.toContain("this doc comment hints")
  })
})
