import { describe, expect, it } from "@effect/vitest"
import { parsePatches } from "../domain/patch/index.ts"
import { initialState, searchTerm, withPatches } from "../tui/index.ts"

const raw = `diff --git a/src/page.ts b/src/page.ts
index 1111111..2222222 100644
--- a/src/page.ts
+++ b/src/page.ts
@@ -1,1 +1,2 @@
 const a = 1
+  const held = useProcessFold(treeQuery, nodeId);
`

const shown = () => withPatches(initialState([]), parsePatches(raw))

const rowWith = (word: string): number =>
  parsePatches(raw)[0]?.rows.findIndex((row) => row.text.includes(word)) ?? 0

describe("what a search looks for", () => {
  it("takes the words the reviewer picked, short ones included", () => {
    // ARRANGE
    const row = rowWith("useProcessFold")
    const text = parsePatches(raw)[0]?.rows[row]?.text ?? ""
    const from = text.indexOf("nodeId")
    const state = { ...shown(), cursor: row, picked: { row, from, to: from + "nodeId".length } }

    // ACT
    const term = searchTerm(state)

    // ASSERT
    expect(term).toBe("nodeId")
  })

  it("falls back to the longest name on the line when nothing is picked", () => {
    // ARRANGE
    const row = rowWith("useProcessFold")
    const state = { ...shown(), cursor: row, anchorRow: row, selecting: true, picked: undefined }

    // ACT
    const term = searchTerm(state)

    // ASSERT
    expect(term).toBe("useProcessFold")
  })
})
