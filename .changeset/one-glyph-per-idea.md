---
"@eliya-oss/agent-diff": patch
---

One glyph per idea. Five marks were carrying twelve meanings: `✓` meant a reviewed file, a settled thread and a sent one — the last of which is the opposite of done; `○` meant "this line has a thread", "this thread is unread" and "this file is in the diff"; `•` drew the same idea as `○` differently; `·` was a bullet and a separator at once; and `▎` was the cursor everywhere except the file tree, which used a background tint instead.

Now `▎` is the cursor row everywhere, `▾`/`▸` are disclosure only, `○ ◐ ●` is one three-state ring for a thread — waiting on the agent, answered, waiting on you — drawn identically in the diff gutter, the review panel, the file tree badge and the layers rail, `✓` means nothing left to do, and `·` is a separator. The file tree's badge counts only threads still open, so it stops promising work that is already settled. The diff no longer marks lines for a comment you removed. The Nerd Font file and folder icons are gone, and the two columns they took go to the path.
