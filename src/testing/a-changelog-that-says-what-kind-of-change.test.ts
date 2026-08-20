import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"

const HEADINGS = new Set(["Breaking", "Added", "Fixed", "Performance"])

const HEAD = /^(?:breaking|feat|fix|perf)\([^)]+\): \S.*\.$/

const linesIn = (text: string): ReadonlyArray<string> => text.split("\n")

const headingsIn = (text: string): ReadonlyArray<string> =>
  linesIn(text)
    .filter((line) => line.startsWith("### "))
    .map((line) => line.slice(4).trim())

const versionsIn = (text: string): ReadonlyArray<string> =>
  linesIn(text)
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim())

const topmost = (text: string): string => {
  const lines = linesIn(text)
  const opens = lines.findIndex((line) => line.startsWith("## "))
  const shuts = lines.findIndex((line, at) => at > opens && line.startsWith("## "))
  return lines.slice(opens, shuts === -1 ? undefined : shuts).join("\n")
}

const bodyOf = (raw: string): string => {
  const parts = raw.split("---")
  return (parts.length > 2 ? parts.slice(2).join("---") : raw).trim()
}

const readingOf = async (name: string): Promise<{ name: string; body: string }> => ({
  name,
  body: bodyOf(await readFile(join(".changeset", `${name}.md`), "utf8")),
})

const KIND = /^(?:breaking|feat|fix|perf)\(/

const isTyped = (body: string): boolean => {
  const heads = linesIn(body).filter((line) => KIND.test(line))
  return heads.length > 0 && heads.every((line) => HEAD.test(line))
}

const releasedIntents = async (): Promise<ReadonlySet<string>> => {
  const ledger = await readFile(".changeset/ledger.yaml", "utf8")
  return new Set(
    linesIn(ledger).flatMap((line) => {
      const named = /^ {4}- (?<name>.+)$/.exec(line)?.groups?.["name"]?.trim()
      return named === undefined ? [] : [named]
    }),
  )
}

describe("a release note", () => {
  it("groups what changed under the kind of change it was", async () => {
    // ARRANGE
    const text = await readFile("CHANGELOG.md", "utf8")

    // ACT
    const headings = headingsIn(text)

    // ASSERT
    expect(versionsIn(text).length).toBeGreaterThan(1)
    expect(headings.length).toBeGreaterThan(0)
    expect([...new Set(headings)].filter((heading) => !HEADINGS.has(heading))).toEqual([])
  })

  it("names the part of adiff each entry is about", async () => {
    // ARRANGE
    const text = await readFile("CHANGELOG.md", "utf8")

    // ACT
    const newest = topmost(text)

    // ASSERT
    const bullets = linesIn(newest).filter((line) => line.startsWith("- "))
    expect(bullets.length).toBeGreaterThan(0)
    expect(bullets.filter((line) => !line.startsWith("- **"))).toEqual([])
    expect(headingsIn(newest).length).toBeGreaterThan(0)
  })

  it("holds every change intent still waiting for a release to the same shape", async () => {
    // ARRANGE
    const released = await releasedIntents()
    const names = (await readdir(".changeset"))
      .filter((name) => name.endsWith(".md"))
      .map((name) => name.slice(0, -3))
      .filter((name) => !released.has(name))

    // ACT
    const bodies = await Promise.all(names.map(readingOf))

    // ASSERT
    const wrong = bodies.filter(({ body }) => !isTyped(body))
    expect(wrong.map(({ name }) => name)).toEqual([])
  })
})
