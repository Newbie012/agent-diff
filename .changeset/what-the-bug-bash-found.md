---
"@eliya-oss/agent-diff": patch
---

Four things a bug bash of the review terminal turned up.

Copying a selection that crosses a change put both versions of every changed line on the clipboard, so the paste was code that existed in neither version of the file. It now copies the version being kept, and still copies deleted lines when that is all you picked.

A comment you were part way through writing is no longer thrown away when the box closes. Escape or ctrl+c keeps it, and reopening on the same lines brings it back. A comment of nothing but spaces is refused with a message instead of reaching the agent as an empty thread.

A terminal too narrow to draw the review in used to leave it blank for good, with no way back short of restarting. It says it needs more room, and comes back when the terminal does.
