---
"@eliya-oss/agent-diff": patch
---

fix(review panel): opening a comment the branch moved past shows the whole thread, with the code it was written on.

<details><summary>What was wrong</summary>

When another line had taken the number the comment was written at, opening it jumped to that line,
where no comment was drawn, and the agent's answer was nowhere to read.

</details>

fix(settling box): marking a file that still holds open threads lists them, and says which one is not in the diff.

<details><summary>What was wrong</summary>

The box counted two threads while the diff showed one, and gave no way to tell where the other was.

</details>
