---
"@eliya-oss/agent-diff": patch
---

feat(review panel): `d` takes a settled thread back, so a point settled too early can be reopened.

<details><summary>What it does</summary>

Pressing `d` on a settled thread unsettles it: the thread opens where it stands, the footer names
the key as "unsettle" while the cursor is on one, and the agent is owed an answer again if it never
gave one. `adiff comment reopen --repo . --branch <branch> --id <id>` does the same from the command
line.

</details>
