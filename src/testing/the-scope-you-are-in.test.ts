import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const deep = [
  "export class Outer {",
  "  method1() {",
  "    method2() {",
  "      method3() {",
  "        method4() {",
  "          method5() {",
  "            method6() {",
  "              const kept = 0",
  "              const changed = 1",
  "            }",
  "          }",
  "        }",
  "      }",
  "    }",
  "  }",
  "}",
]

const changed = deep.map((line) =>
  line.includes("const changed") ? line.replace("= 1", "= 2") : line,
)

describe("the scope pinned above the diff", () => {
  it("keeps the innermost scopes and says that outer ones were dropped", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [{ path: "src/deep.ts", before: deep, after: changed }],
    })

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ASSERT
    const bodies = (await driver.screen.getFrame())
      .split("\n")
      .map((line) => (line.split("││")[1] ?? "").split("│")[0] ?? "")
    const pinned = bodies.slice(0, bodies.findIndex((body) => /^\s*\d/.test(body)))
    const said = pinned.join("\n")
    expect(said).toContain("class Outer")
    expect(said).toContain("\u22ef")
    expect(said).toContain("method4")
    expect(said).not.toContain("method1")
  })
})
