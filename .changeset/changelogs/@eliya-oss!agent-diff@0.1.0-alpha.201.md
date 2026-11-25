## 0.1.0-alpha.201

### Patch Changes

- fix(file tree): a comment the branch moved past no longer marks its file or its layer part, since no line in the diff draws it.

  <details><summary>What was wrong</summary>

  A file whose only open comment was on code the branch had since rewritten still showed that comment's mark in the file tree and in the layers rail. Opening the file showed no comment anywhere, because a comment the branch moved past is read in the review panel.

  </details>

- fix(reading order): asking for a reading order while an earlier request is still open adds to that request instead of filing a second one.

  <details><summary>What was wrong</summary>

  Each press of `L`, and each `layers ask`, filed a new comment about the branch, so the review panel listed the same request several times.

  </details>

- feat(CLI): `comment list` counts the comments waiting on your answer and the ones holding an answer you have not read.
