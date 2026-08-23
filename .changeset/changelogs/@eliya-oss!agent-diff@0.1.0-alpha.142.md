## 0.1.0-alpha.142

### Patch Changes

- fix(diff): a comment moves to wherever its code went when the agent edits the file above it.

  <details><summary>What was wrong</summary>

  A comment was drawn at the line number it was written at. When the agent added or removed lines
  above that code, every comment in the file stayed on its old number and pointed at whatever had
  moved into it. A comment carries the exact snippet it was written against, and that is now what
  places it.

  </details>

  fix(diff): a comment whose code the agent rewrote is not drawn against the line that took its place.

  <details><summary>What was wrong</summary>

  When the code a comment was about was changed rather than moved, there was nothing to move the
  comment to, and it stayed on its old line — reading as a remark about code it was never about. Such
  a thread is now left off the diff and kept in the review panel, which says it is not in the diff.

  </details>

  fix(diff): an answer with more than one line keeps its lines.

  <details><summary>What was wrong</summary>

  An agent's answer and a reviewer's reply were flattened to a single paragraph, so a bulleted answer
  read as one run-on sentence. The reviewer's own comment kept its breaks, so the two sides of a
  thread were drawn by different rules.

  </details>
