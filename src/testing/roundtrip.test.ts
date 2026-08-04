import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lines = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `  const step${index} = ${mark}(${index})`)

const branch = {
  files: [
    {
      path: "api/one.ts",
      before: ["export function one() {", ...lines(20, "kept"), ...lines(40, "settle"), "}"],
      after: ["export function one() {", ...lines(20, "kept"), ...lines(40, "resolve"), "}"],
    },
    {
      path: "api/two.ts",
      before: ["export function two() {", ...lines(40, "settle"), "}"],
      after: ["export function two() {", ...lines(40, "resolve"), "}"],
    },
    {
      path: "zz/notes.md",
      before: ["# notes", "old line"],
      after: ["# notes", "new line"],
    },
  ],
}

const body = (frame: string): string => {
  const rows = frame.split("\n")
  return rows.slice(0, Math.max(0, rows.length - 2)).join("\n")
}

type Pair = {
  readonly name: string
  readonly go: ReadonlyArray<string>
  readonly back: ReadonlyArray<string>
}

const pairs: ReadonlyArray<Pair> = [
  { name: "cursor down and up", go: ["j", "j", "j"], back: ["k", "k", "k"] },
  { name: "end and start", go: ["G"], back: ["g"] },
  { name: "next file and previous", go: ["]"], back: ["["] },
  { name: "fold and unfold", go: ["h"], back: ["l"] },
  { name: "hide and show the list", go: ["\\"], back: ["\\"] },
  { name: "focus across and back", go: ["TAB"], back: ["TAB"] },
  { name: "wider and narrower context", go: ["+"], back: ["-"] },
  { name: "mark and unmark", go: ["m"], back: ["m"] },
]

describe("every reversible action reverses", () => {
  for (const pair of pairs) {
    it(pair.name, async () => {
      // ARRANGE
      await using driver = await TestDriver.create()
      await driver.branch.create(branch)
      await driver.screen.open()
      await driver.screen.pressKeys(["RETURN"])
      const start = body(await driver.screen.getFrame())

      // ACT
      await driver.screen.pressKeys([...pair.go])
      const moved = body(await driver.screen.getFrame())
      await driver.screen.pressKeys([...pair.back])

      // ASSERT
      expect(moved).not.toBe(start)
      expect(body(await driver.screen.getFrame())).toBe(start)
      expect(driver.screen.renderCrashes()).toEqual([])
    })
  }
})
