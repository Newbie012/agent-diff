import { readdir, readFile } from "node:fs/promises"
import { describe, expect, it } from "@effect/vitest"

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

describe("a change intent", () => {
  it("is gone from .changeset once a release has shipped it", async () => {
    // ARRANGE
    const shipped = await consumed()

    // ACT
    const held = (await readdir(".changeset"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3))

    // ASSERT
    expect(held.filter((name) => shipped.has(name))).toEqual([])
  })

  it("leaves its words behind in the changelog", async () => {
    // ARRANGE
    const text = await readFile("CHANGELOG.md", "utf8")

    // ACT
    const versions = versionsIn(text)

    // ASSERT
    expect(versions.length).toBeGreaterThanOrEqual(SHIPPED)
  })
})
