---
"@eliya-oss/agent-diff": patch
---

fix(file tree): the review opens with the folder holding your file already open.

<details><summary>What was wrong</summary>

In a repo with enough files that folders start collapsed, the folder holding the opening file was collapsed too — so nothing in the rail was marked, and the only way to see where you were was to press `l`. With forty-five files across five folders, seventeen of twenty-seven rail rows sat empty while the current file was hidden.

</details>
