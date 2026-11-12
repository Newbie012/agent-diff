---
"@eliya-oss/agent-diff": patch
---

fix(marks): marking a file after its directory was switched to another branch records nothing, and the footer names the branch the directory is on now.

<details><summary>What was wrong</summary>

Review state is filed under the branch the directory is on. Checking out another branch there
mid-review sent every new mark to that branch and showed its marks in the file list, so a review
with twenty-eight files ticked suddenly showed four.

</details>
