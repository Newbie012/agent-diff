## 0.1.0-alpha.58

### Patch Changes

- Syntax colour is read from the file now, not from the diff. The visible rows were handed to the parser as if they were a document, so a hunk starting inside a JSX block or an object literal gave it no opening to find, and the gap and comment rows between hunks were fed to it as code — which is why colour looked right in some files and wrong in others. Both sides of the file are parsed whole and the colours laid onto the rows that show them.

  Three things around the diff were fixed with it. The pinned scope no longer keeps the previous file's line: the memo that skips redrawing an unchanged pin was reset without the pin being cleared, so an empty chain skipped the redraw and left the old scope on screen. Scrolling a deeply indented file no longer jumps, because the rows available to scroll through no longer shrink and grow with the pinned scope under the cursor. And `option` and `command` with backspace take back a word and a line while writing a comment, rather than one character like a bare backspace.

  `}` and `{` walk changes rather than hunks. They jumped to the top of a hunk, which is its leading context, so the cursor landed three lines short of the thing it was jumping to — and with the whole file shown there was only ever one hunk, so they stopped working entirely. They now step from one run of changed lines to the next, which works at any width and lands on the change.

  Opening a comment from the review panel brings the diff to it. The row was worked out from the diff before its gap and comment rows were counted in, so it landed somewhere else in the file — often the end. A comment whose line is not in the diff at all says so rather than moving you somewhere arbitrary.

  The review screen also uses the two rows it was leaving empty above and below itself.
