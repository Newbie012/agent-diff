---
"@eliya-oss/agent-diff": patch
---

fix(layers rail): the cursor stays on the rail when you collapse the layer you are reading.

<details><summary>What was wrong</summary>

Collapsing took the cursor off the whole rail — nothing said where you were, and the layer read like one you had not started. A collapsed layer holding the cursor carries it on its title row now.

</details>

fix(layers rail): `r` picks up rewritten layers without leaving the rail cursorless and `l` dead.

<details><summary>What was wrong</summary>

After the agent rewrote the layers, the layer holding your file was collapsed, the rail had no cursor, and `l` did nothing at all, because both were still keyed to the layer index from before the reload. The index is recomputed from the file the cursor is on.

</details>

fix(reading order): a first layer naming no file in the diff opens the review at the first file, not the last.

<details><summary>What was wrong</summary>

One bad path from the agent was enough. Finding a place in the reading order looked for file 0 in layer 0, failed because layer 0 held no files, and fell back to the first appearance of diff-order file 0 — wherever the layers happened to put it. It lands on the first entry of the reading order now.

</details>

fix(layers rail): a file two layers both claim counts as two stops, so the counter follows `]`.

<details><summary>What was wrong</summary>

The counter de-duplicated the reading order and took the first match, so it read `file 1 of 3` at the end of the walk and `]` looked dead on the press between the two copies. The cursor bar is also limited to the layer being read, so the rail can say which copy you are on.

</details>

fix(layers rail): a layer whose spans name nothing in the diff says what it was pointing at, and keeps its note.

<details><summary>What was wrong</summary>

It drew a bare title with no files, no count and no note, while `adiff layers show` knew exactly what had happened. It says `nothing in this diff: pkg/ghost.ts` now. A note stays out of the rail everywhere else — the diff carries it there — but a layer with no file has nowhere else to put it.

</details>
