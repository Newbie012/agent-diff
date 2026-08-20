---
"@eliya-oss/agent-diff": patch
---

feat(keys): `t` shows or hides the file list on its own, leaving the review panel where it is.

<details><summary>What was wrong</summary>

`z` hid the file list and the review panel together, so reading a wide diff beside your comments meant hiding both and bringing one back — `z` then `a`, which works by accident of composition rather than because anything offers it.

</details>

fix(footer): a stale reading order says which key asks for a new one.

<details><summary>What was wrong</summary>

The header said `layers stale` and stopped there, and `L` was in neither footer, so the one thing to do about it was only findable by reading the key sheet. The header now names the key, and the footer offers it while the order is stale.

</details>
