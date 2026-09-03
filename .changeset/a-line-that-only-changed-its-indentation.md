---
"@eliya-oss/agent-diff": patch
---

feat(diff): a line that only changed its indentation is shown once, as unchanged, so a block wrapped in a new function is two added lines and not a rewrite of every line inside it.

<details><summary>What was wrong</summary>

Wrapping twenty-five lines in `startTransition(() => { … })` drew twenty-five removed lines and
twenty-seven added ones, and the reviewer had to read both blocks to find the two that mattered.

</details>
