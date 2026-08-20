---
"@eliya-oss/agent-diff": patch
---

fix(keys): `g`, `G` and the page keys move the pane you are looking at.

<details><summary>What was wrong</summary>

With the file list or the review panel focused they moved the diff cursor instead — invisibly, since you were not looking at the diff — so the only way through a long list was one row at a time. Sixty presses from the bottom of a forty-layer rail to the top.

</details>

fix(layers rail): `f` hides files already reviewed while you read layers, as it already did in the file tree.

<details><summary>What was wrong</summary>

The same key did something in one rail and nothing in the other, and the header count disagreed with what was on screen.

</details>

fix(review panel): a comment on a line hidden inside a collapsed gap can be reached.

<details><summary>What was wrong</summary>

It said the comment was outside the diff while the file it belongs to was open on screen. It now opens the gaps and goes there.

</details>
