---
"@eliya-oss/agent-diff": patch
---

fix(diff): an arrow pressed after a short scroll that leaves the cursor on screen keeps the view where the scroll left it.

<details><summary>What was wrong</summary>

The arrow moved the cursor one line and jumped the view back to where it was before the scroll, so the reader lost their place.

</details>
