---
"@eliya-oss/agent-diff": patch
---

`g`, `G` and the page keys move whatever pane has focus. With the file list or the review panel focused they moved the diff cursor instead — invisibly, since you were not looking at the diff — so the only way through a long list was one row at a time. Sixty presses to get from the bottom of a forty-layer rail to the top.

Hiding reviewed files now works while reading layers. `f` was honoured by the file tree and ignored by the layers rail, so the same key did something in one rail and nothing in the other, and the header count disagreed with what you could see.

A comment on a line that is hidden inside a collapsed gap can be reached from the review panel. It used to say the comment was outside the diff while the file it belongs to was open on screen; it now opens the gaps and goes there.
