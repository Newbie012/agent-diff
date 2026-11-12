---
"@eliya-oss/agent-diff": patch
---

feat(review pane): in a Harbor terminal, `adiff review pane` opens the review as a child terminal under the agent's.

<details><summary>Why</summary>

Harbor could not split, so an agent working there handed over a command to run instead of the review itself.

</details>
