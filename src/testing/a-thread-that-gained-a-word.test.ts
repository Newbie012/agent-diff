import { describe, expect, it } from "@effect/vitest"
import { noteKey, type Note } from "../tui/index.ts"

const note: Note = {
  id: "c1",
  folded: false,
  side: "new",
  line: 4,
  body: "why two of these",
  sent: true,
  settled: false,
  stale: false,
  asks: false,
  answers: [],
  turns: [],
}

const said = (turns: Note["turns"]): Note => ({ ...note, turns })

describe("telling one drawing of a thread from another", () => {
  it("counts an answer that arrived", () => {
    // ARRANGE
    const before = note
    const after = { ...note, answers: ["dropped it"] }

    // ACT
    const keys = [noteKey(before), noteKey(after)]

    // ASSERT
    expect(keys[0]).not.toBe(keys[1])
  })

  it("counts a reply written into it", () => {
    // ARRANGE
    const before = said([{ voice: "agent", body: "which two" }])
    const after = said([
      { voice: "agent", body: "which two" },
      { voice: "reviewer", body: "the imports" },
    ])

    // ACT
    const keys = [noteKey(before), noteKey(after)]

    // ASSERT
    expect(keys[0]).not.toBe(keys[1])
  })

  it("counts the thread being answered rather than asked", () => {
    // ARRANGE
    const before = { ...note, asks: true }
    const after = { ...note, asks: false }

    // ACT
    const keys = [noteKey(before), noteKey(after)]

    // ASSERT
    expect(keys[0]).not.toBe(keys[1])
  })

  it("stays the same when nothing about the thread did", () => {
    // ARRANGE
    const before = said([{ voice: "agent", body: "which two" }])
    const after = said([{ voice: "agent", body: "which two" }])

    // ACT
    const keys = [noteKey(before), noteKey(after)]

    // ASSERT
    expect(keys[0]).toBe(keys[1])
  })
})
