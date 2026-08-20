import { readdir, readFile } from "node:fs/promises"
import { describe, expect, test } from "@effect/vitest"

const SHIPPED = 135

const linesIn = (text: string): ReadonlyArray<string> => text.split("\n")

const versionsIn = (text: string): ReadonlyArray<string> =>
  linesIn(text)
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim())

const consumed = async (): Promise<ReadonlySet<string>> => {
  const ledger = await readFile(".changeset/ledger.yaml", "utf8")
  return new Set(
    linesIn(ledger).flatMap((line) => {
      const found = /^ {4}- (?<name>.+)$/.exec(line)?.groups?.["name"]?.trim()
      return found === undefined ? [] : [found]
    }),
  )
}

describe("when a release ships a change intent", () => {
  test("then the intent is gone from .changeset", async () => {
    // ARRANGE
    const shipped = await consumed()

    // ACT
    const held = (await readdir(".changeset"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3))

    // ASSERT
    expect(held.filter((name) => shipped.has(name))).toEqual([])
  })

  test("then the intent's words are in the changelog", async () => {
    // ARRANGE
    const text = await readFile("CHANGELOG.md", "utf8")

    // ACT
    const versions = versionsIn(text)

    // ASSERT
    expect(versions.length).toBeGreaterThanOrEqual(SHIPPED)
  })
})
