---
"@eliya-oss/agent-diff": patch
---

fix(marks): a layer marked read stays read when the agent changes the file only in another layer's lines, and marking that layer again unmarks it.

<details><summary>What was wrong</summary>

A file two layers share was read one layer at a time. When the agent changed the file in one layer's lines, every layer of the file went back to unread, so a layer with nothing new in it asked to be read again and its Since review view had nothing to show. A file marked read whole already kept its untouched layers. And on a layer kept read that way, pressing mark recorded a new mark instead of taking the layer back out.

</details>
