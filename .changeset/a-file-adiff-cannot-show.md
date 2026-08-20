---
"@eliya-oss/agent-diff": patch
---

fix(diff): a binary file says it is binary instead of drawing an empty pane.

<details><summary>What was wrong</summary>

git reports it as changed and adiff listed it in the file tree, but opening it showed a pane with nothing in it — indistinguishable from a rendering failure.

</details>
