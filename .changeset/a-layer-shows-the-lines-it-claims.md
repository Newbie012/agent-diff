---
"@eliya-oss/agent-diff": patch
---

fix(layers): a layer shows the changed lines it claims, and the lines another layer claims are one line saying which layer that is, even inside the run it is showing.

<details><summary>What was wrong</summary>

A reading order written one layer to a commit splits a long run of changed lines between several
layers. Scoping a layer to whole runs still drew all of a 276-line run for every layer that claimed
any line of it, so a reviewer walking eleven commits read the same block eleven times.

</details>
