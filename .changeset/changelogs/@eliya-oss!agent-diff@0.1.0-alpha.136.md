## 0.1.0-alpha.136

### Patch Changes

- fix(layers rail): the wheel keeps working after a flick, and moves one file per notch.

  <details><summary>What was wrong</summary>

  The guard that stopped a trackpad flick running on past the gesture was never cleared when a move failed, so after one bad load the rail stopped answering the wheel entirely. It is cleared whatever happens now, and a notch that arrives mid-load is remembered rather than thrown away, so movement keeps up with the gesture instead of dropping out of it.

  The wheel was also registered twice over the file list — once on the pane and once on the text inside it — so a single notch moved two files.

  </details>

  perf(diff): the diff is not handed to the highlighter again when only the pane width changed.

  <details><summary>What was wrong</summary>

  Toggling the review panel reassigned the code pane's contents even though the text was identical, which starts a fresh parse and draws the file unhighlighted until it finishes.

  </details>

- fix(key sheet): `?` fills the screen and lays the keys out in two columns under their section headings.

  <details><summary>What was wrong</summary>

  Fifty keys were drawn in one narrow column the same size and shape as the command palette, so it scrolled even on a tall terminal and the category was repeated on every row instead of heading a section. The two columns fit most of the sheet at once, the headings say what each group is, and the space the repeated category took goes to the descriptions, which were being cut mid-word.

  </details>

- fix(review panel): opening the panel puts the keys on it, and closing gives them back to the pane you came from.

  <details><summary>What was wrong</summary>

  `a` opened the panel and left the keys wherever they were, so the comments you had just asked to see could not be moved through without a second press of `tab`. Closing it sent the keys to the diff whatever you had been reading before, so opening and closing the panel quietly moved you off the file list. The panel is left alone when there is nothing in it to read.

  </details>
