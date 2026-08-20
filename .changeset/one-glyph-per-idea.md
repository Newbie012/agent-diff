---
"@eliya-oss/agent-diff": patch
---

fix(marks): one glyph per idea — `▎` is the cursor everywhere, `○ ◐ ●` is one three-state ring for a thread, `✓` means nothing left to do.

<details><summary>What was wrong</summary>

Five marks were carrying twelve meanings. `✓` meant a reviewed file, a settled thread and a sent one — the last of which is the opposite of done. `○` meant "this line has a thread", "this thread is unread" and "this file is in the diff". `•` drew the same idea as `○` differently, `·` was a bullet and a separator at once, and `▎` was the cursor everywhere except the file tree, which used a background tint instead.

The ring is drawn identically in the diff gutter, the review panel, the file tree badge and the layers rail: waiting on the agent, answered, waiting on you. `▾`/`▸` are disclosure only, and `·` is a separator.

</details>

fix(file tree): the badge counts only threads still open, so it stops promising work that is already settled.

fix(file tree): the Nerd Font file and folder icons are gone, and the two columns they took go to the path.

fix(diff): lines are no longer marked for a comment you removed.
