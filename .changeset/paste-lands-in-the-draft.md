---
"@eliya-oss/agent-diff": patch
---

Pasting into a comment works. The terminal hands a paste over in one piece rather than replaying it as keystrokes, and adiff was only listening for keystrokes, so every paste was read correctly and then thrown away — nothing appeared, and quoting a stack trace or an error message meant retyping it. A paste now lands at the caret in one move. Line breaks survive in a draft and become spaces in the palette, whose query is one line; tabs become two spaces so pasted code keeps its shape; escape sequences and control characters are stripped, because a comment is prose an agent reads back rather than a channel to the screen.
