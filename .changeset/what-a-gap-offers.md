---
"@eliya-oss/agent-diff": patch
---

fix(diff): a collapsed gap says what its keys do — `⋯ 26 lines hidden · l opens 10, F opens all`.

<details><summary>What was wrong</summary>

The old text did not say that `l` reveals ten at a time, so on a large gap it looked like nothing was happening, and it never mentioned `F`, which opens the whole file at once. A gap smaller than one press now says `l opens them`.

</details>
