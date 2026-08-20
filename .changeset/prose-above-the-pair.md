---
"@eliya-oss/agent-diff": patch
---

fix(layers): a layer's note about a changed line sits above the change, not inside it.

<details><summary>What was wrong</summary>

When a line is replaced, git shows the old and the new one after the other, and the note was drawn between them — so four rows of prose split the one pairing a diff exists to show, on the first screen of the review.

</details>
