import { describe, expect, it } from "@effect/vitest"
import { caretColumn, caretOn, caretRow, laidDraft } from "../tui/index.ts"

describe("laying a draft out for a screen", () => {
  it("keeps every character the reviewer typed", () => {
    // ARRANGE
    const draft = "two  spaces and a trailing one "

    // ACT
    const rows = laidDraft(draft, 12)

    // ASSERT
    expect(rows.map((row) => row.text).join("")).toBe(draft)
  })

  it("breaks on a space rather than mid-word where it can", () => {
    // ARRANGE
    const draft = "alpha bravo charlie"

    // ACT
    const rows = laidDraft(draft, 12)

    // ASSERT
    expect(rows.map((row) => row.text)).toEqual(["alpha bravo ", "charlie"])
  })

  it("breaks inside a word too long for the room", () => {
    // ARRANGE
    const draft = "supercalifragilistic"

    // ACT
    const rows = laidDraft(draft, 8)

    // ASSERT
    expect(rows.map((row) => row.text)).toEqual(["supercal", "ifragili", "stic"])
  })

  it("gives a blank line of its own a row", () => {
    // ARRANGE
    const draft = "one\n\nthree"

    // ACT
    const rows = laidDraft(draft, 20)

    // ASSERT
    expect(rows.map((row) => row.text)).toEqual(["one", "", "three"])
    expect(rows.map((row) => row.from)).toEqual([0, 4, 5])
  })

  it("finds the row and column a caret sits on", () => {
    // ARRANGE
    const rows = laidDraft("alpha bravo charlie", 12)

    // ACT
    const row = caretRow(rows, 14)
    const column = caretColumn(rows, 14)

    // ASSERT
    expect(row).toBe(1)
    expect(column).toBe(2)
  })

  it("moves to the same column on another row", () => {
    // ARRANGE
    const rows = laidDraft("alpha bravo charlie", 12)

    // ACT
    const up = caretOn(rows, 0, 2)

    // ASSERT
    expect(up).toBe(2)
  })

  it("stops at the end of a shorter row", () => {
    // ARRANGE
    const rows = laidDraft("a long first line here\nno", 24)

    // ACT
    const down = caretOn(rows, 1, 20)

    // ASSERT
    expect(down).toBe(25)
  })
})
