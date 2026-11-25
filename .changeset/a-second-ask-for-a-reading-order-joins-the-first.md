---
"@eliya-oss/agent-diff": patch
---

fix(reading order): asking for a reading order while an earlier request is still open adds to that request instead of filing a second one.

<details><summary>What was wrong</summary>

Each press of `L`, and each `layers ask`, filed a new comment about the branch, so the review panel listed the same request several times.

</details>
