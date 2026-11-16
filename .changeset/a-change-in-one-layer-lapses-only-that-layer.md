---
"@eliya-oss/agent-diff": patch
---

fix(layers): a change to one layer's lines of a file layers share leaves the file read in the other layers, and `review progress` names the layers whose part changed.

<details><summary>What was wrong</summary>

When the agent changed a few lines of a file that two layers share, every mark on the file lapsed. The
layer whose lines did not change read as unread again, and opening the file there showed nothing to
read, since every changed line belonged to the other layer. Lines that only moved down now count as
untouched too.

</details>
