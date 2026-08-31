## 0.1.0-alpha.169

### Patch Changes

- fix(base): escape closes the base picker and leaves the base as it was.

  <details><summary>What was wrong</summary>

  The picker took escape and did nothing with it. The only ways out were choosing a ref, handing the
  choice back to adiff, or quitting the terminal.

  </details>

  fix(editor): escape closes the list of editors and opens nothing.

  <details><summary>What was wrong</summary>

  Pressing the key with no editor found opened the list, and escape left it on screen. A reviewer who
  did not mean to choose an editor had to pick one anyway.

  </details>
