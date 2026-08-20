import { readFile } from "node:fs/promises"
import { describe, expect, it } from "@effect/vitest"

const NUMBERS = /\d+/g

const rankOf = (version: string): ReadonlyArray<number> =>
  [...version.matchAll(NUMBERS)].map((found) => Number(found[0]))

const isAfter = (one: string, two: string): boolean => {
  const left = rankOf(one)
  const right = rankOf(two)
  const most = Math.max(left.length, right.length)
  for (let at = 0; at < most; at += 1) {
    const step = (left[at] ?? 0) - (right[at] ?? 0)
    if (step !== 0) return step > 0
  }
  return false
}

const versionsIn = (text: string): ReadonlyArray<string> =>
  text
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim())

describe("the changelog", () => {
  it("reads newest first, counting versions as numbers rather than as words", async () => {
    // ARRANGE
    const text = await readFile("CHANGELOG.md", "utf8")

    // ACT
    const versions = versionsIn(text)

    // ASSERT
    expect(versions.length).toBeGreaterThan(1)
    const outOfOrder = versions.filter(
      (version, at) => at > 0 && !isAfter(versions[at - 1] ?? "", version),
    )
    expect(outOfOrder).toEqual([])
  })

  it("puts the version now released at the top", async () => {
    // ARRANGE
    const [text, manifest] = await Promise.all([
      readFile("CHANGELOG.md", "utf8"),
      readFile("package.json", "utf8"),
    ])

    // ACT
    const top = versionsIn(text)[0]

    // ASSERT
    const released = (JSON.parse(manifest) as { version: string }).version
    expect(top).toBe(released)
  })
})
