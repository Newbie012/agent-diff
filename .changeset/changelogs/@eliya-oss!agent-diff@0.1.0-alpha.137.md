## 0.1.0-alpha.137

### Patch Changes

- fix(diff): a layer's prose carries a rule down its margin, so it cannot be read as the file.

  <details><summary>What was wrong</summary>

  The prose sat between two lines of code with no line number, no marker and nothing else to say it was not part of the file, so a note about the change below it read as stray markdown someone had committed.

  </details>

  perf(diff): turning to the next file takes about 15ms, down from about 77ms.

  <details><summary>What was wrong</summary>

  Every turn read the whole file at both ends of the diff before the screen moved, and those two reads exist only to feed syntax highlighting. The diff itself is already in memory, so the file now opens straight away and the colour follows it.

  </details>

- feat(keys): `t` shows or hides the file list on its own, leaving the review panel where it is.

  <details><summary>What was wrong</summary>

  `z` hid the file list and the review panel together, so reading a wide diff beside your comments meant hiding both and bringing one back — `z` then `a`, which works by accident of composition rather than because anything offers it.

  </details>

  fix(footer): a stale reading order says which key asks for a new one.

  <details><summary>What was wrong</summary>

  The header said `layers stale` and stopped there, and `L` was in neither footer, so the one thing to do about it was only findable by reading the key sheet. The header now names the key, and the footer offers it while the order is stale.

  </details>
