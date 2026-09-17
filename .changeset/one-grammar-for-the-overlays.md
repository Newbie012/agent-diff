---
"@eliya-oss/agent-diff": patch
---

feat(command palette): every overlay is drawn the same way: a bold title with its count at the right edge, a `›` before the query, one empty row between title, query, list and keys, the keys that work inside the box, and no line at the left edge.

<details><summary>What was wrong</summary>

Each overlay had its own spacing, its own title colour and its own row lead. The title and the
placeholder shared one faint colour on adjacent rows, the settings indented their titles two columns
past the palette's, and the keys that worked sat in the footer under the scrim, dimmed by the very
box they described.

</details>

feat(preferences): the preferences are a sheet along the bottom of the terminal, one row per preference with `on` or `off` in a value column, and what the highlighted one does said once under the list.

<details><summary>What was wrong</summary>

The preferences opened as a box over the middle of the diff, two rows per preference, so toggling
one meant looking past the box to see the diff it changed.

</details>

feat(command palette): commands are grouped under their category's headline, and the cursor row is painted across the whole box.

feat(preferences): the editor a line opens in is the last row of the preferences sheet, and return on it offers the editors on the machine.

fix(command palette): return runs the command under the cursor; it used to run the first match, because the return key reached the filter box first and reset the cursor.

fix(preferences): escape closes the sheet after a visit to the editor picker; it used to bounce back to the sheet forever.

fix(search): an empty search is one faint row saying where the matches will list, instead of a nine-row void.
