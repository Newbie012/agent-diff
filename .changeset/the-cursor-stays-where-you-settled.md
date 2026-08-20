---
"@eliya-oss/agent-diff": patch
---

fix(review panel): the cursor keeps its place when you settle a thread, so the next one comes to it.

<details><summary>What was wrong</summary>

Settling followed the thread into the Settled section at the bottom of the panel, so closing a
column of threads meant walking back up to the top after every one.

</details>

fix(keys): tab moves to the next pane on the screen instead of bringing the file list back.

<details><summary>What was wrong</summary>

Hiding the file list with `t` and then pressing tab reopened it, so there was no way to move
between the diff and the review panel with the room the file list had been taking.

</details>
