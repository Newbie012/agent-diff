---
"@eliya-oss/agent-diff": patch
---

fix(diff): copying across a collapsed gap no longer puts adiff's own `⋯ 103 lines hidden` marker on the clipboard.

fix(diff): `y` copies the selection you made even when the cursor is resting on a comment.

fix(footer): the two numbers on screen say what they count — `4 lines selected` against `2 lines copied`.

<details><summary>Why they differ</summary>

A change shows both its old and its new line, and copy takes the one you are keeping.

</details>
