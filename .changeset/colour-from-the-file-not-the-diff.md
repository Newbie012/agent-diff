---
"@eliya-oss/agent-diff": patch
---

Syntax colour is read from the file now, not from the diff. The visible rows were handed to the parser as if they were a document, so a hunk starting inside a JSX block or an object literal gave it no opening to find, and the gap and comment rows between hunks were fed to it as code — which is why colour looked right in some files and wrong in others. Both sides of the file are parsed whole and the colours laid onto the rows that show them.

Three things around the diff were fixed with it. The pinned scope no longer keeps the previous file's line: the memo that skips redrawing an unchanged pin was reset without the pin being cleared, so an empty chain skipped the redraw and left the old scope on screen. Scrolling a deeply indented file no longer jumps, because the rows available to scroll through no longer shrink and grow with the pinned scope under the cursor. And `option` and `command` with backspace take back a word and a line while writing a comment, rather than one character like a bare backspace.

The review screen also uses the two rows it was leaving empty above and below itself.
