---
"@eliya-oss/agent-diff": patch
---

Dragging over lines in the diff copies them when the drag ends, and they stay selected. `y` copies the line the cursor is on without selecting first, or the whole answer when the cursor is on one. On a Mac the text reaches the pasteboard even when the terminal drops the escape.
