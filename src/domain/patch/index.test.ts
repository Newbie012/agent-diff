import { describe, expect, it } from "@effect/vitest"
import { Option } from "effect"
import { anchorFor, parsePatches, rowsForRange, type Patch } from "./index.ts"

const unified = [
  "diff --git a/src/api/incidents.ts b/src/api/incidents.ts",
  "index a1b2c3d..9f8e7d6 100644",
  "--- a/src/api/incidents.ts",
  "+++ b/src/api/incidents.ts",
  "@@ -34,3 +34,4 @@ export function client() {",
  " const CACHE_TTL = 30_000",
  "+const MAX_RETRIES = 3",
  "-export async function fetchIncident(id: IncidentId) {",
  "+export async function fetchIncident(id: IncidentId): Promise<Incident> {",
  " }",
  "@@ -60,1 +61,2 @@ export function client() {",
  " const tail = 1",
  "+const extra = 2",
  "",
].join("\n")

const only = (patches: ReadonlyArray<Patch>): Patch => {
  const first = patches[0]
  if (first === undefined) throw new Error("expected one patch")
  return first
}

describe("parsePatches", () => {
  it("names the file and its blob", () => {
    const patch = only(parsePatches(unified))
    expect(patch.path).toBe("src/api/incidents.ts")
    expect(patch.blob).toBe("9f8e7d6")
  })

  it("counts rows over hunk bodies only, so headers occupy no row", () => {
    const patch = only(parsePatches(unified))
    expect(patch.rows).toHaveLength(7)
    expect(patch.rows[0]?.text).toBe("const CACHE_TTL = 30_000")
    expect(patch.rows[0]?.kind).toBe("context")
  })

  it("numbers each side independently", () => {
    const patch = only(parsePatches(unified))
    const added = patch.rows[1]
    expect(added?.kind).toBe("added")
    expect(Option.getOrNull(added?.newLine ?? Option.none())).toBe(35)
    expect(Option.isNone(added?.oldLine ?? Option.none())).toBe(true)
  })

  it("records each hunk with the scope git names after the marker", () => {
    const patch = only(parsePatches(unified))
    expect(patch.hunks).toHaveLength(2)
    expect(patch.hunks[0]?.scope).toBe("export function client() {")
    expect(patch.hunks[1]?.startRow).toBe(5)
  })

  it("reports the unchanged lines a hunk boundary skips", () => {
    const patch = only(parsePatches(unified))
    expect(patch.hunks[0]?.skipped).toBe(0)
    expect(patch.hunks[1]?.skipped).toBeGreaterThan(0)
  })

  it("separates multiple files", () => {
    const two = `${unified}diff --git a/b.ts b/b.ts\nindex 1..2 100644\n--- a/b.ts\n+++ b/b.ts\n@@ -1,1 +1,1 @@\n x\n`
    expect(parsePatches(two).map((p) => p.path)).toEqual(["src/api/incidents.ts", "b.ts"])
  })

  it("a diff with no patches yields none", () => {
    expect(parsePatches("")).toHaveLength(0)
  })
})

describe("anchorFor", () => {
  it("anchors a selection to the new side when it contains added lines", () => {
    const patch = only(parsePatches(unified))
    const anchor = Option.getOrThrow(anchorFor(patch, 1, 3))
    expect(anchor.side).toBe("new")
    expect(anchor.start).toBe(35)
    expect(anchor.end).toBe(36)
    expect(anchor.blob).toBe("9f8e7d6")
  })

  it("anchors a pure deletion to the old side", () => {
    const patch = only(parsePatches(unified))
    const anchor = Option.getOrThrow(anchorFor(patch, 2, 2))
    expect(anchor.side).toBe("old")
    expect(anchor.start).toBe(35)
  })

  it("carries the selected source so the reader needs no other reference", () => {
    const patch = only(parsePatches(unified))
    const anchor = Option.getOrThrow(anchorFor(patch, 0, 1))
    expect(anchor.snippet).toBe("const CACHE_TTL = 30_000\nconst MAX_RETRIES = 3")
  })

  it("an empty range anchors to nothing", () => {
    const patch = only(parsePatches(unified))
    expect(Option.isNone(anchorFor(patch, 99, 99))).toBe(true)
  })
})

describe("rowsForRange", () => {
  it("round-trips an anchor back to the rows it came from", () => {
    const patch = only(parsePatches(unified))
    const anchor = Option.getOrThrow(anchorFor(patch, 1, 3))
    expect(Option.getOrThrow(rowsForRange(patch, anchor))).toEqual([1, 3])
  })

  it("a range the patch no longer shows resolves to nothing", () => {
    const patch = only(parsePatches(unified))
    expect(Option.isNone(rowsForRange(patch, { side: "new", start: 900, end: 901 }))).toBe(true)
  })
})
