---
"@eliya-oss/agent-diff": patch
---

fix(review panel): opening the panel puts the keys on it, and closing gives them back to the pane you came from.

<details><summary>What was wrong</summary>

`a` opened the panel and left the keys wherever they were, so the comments you had just asked to see could not be moved through without a second press of `tab`. Closing it sent the keys to the diff whatever you had been reading before, so opening and closing the panel quietly moved you off the file list. The panel is left alone when there is nothing in it to read.

</details>
