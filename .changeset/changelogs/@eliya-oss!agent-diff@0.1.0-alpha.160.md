## 0.1.0-alpha.160

### Patch Changes

- feat(diff): The sheet of keys carries a legend along its foot, naming each mark a thread can carry, the remark mark, and the marks for your words and the agent's.

- feat(diff): the editor a line opens in is chosen in the terminal, from the editors found on your machine.

  <details><summary>What was wrong</summary>

  A reviewer with no editor in the environment was told to set `$VISUAL` or edit the settings file —
  a chore instead of an editor. Pressing the key now offers the editors found on the path, narrowed by
  typing, and a command typed in full is accepted; choosing one opens the line straight away.
  Changing it later is in the command palette, and one key there hands the choice back to the
  environment.

  </details>

- fix(review): The panel quotes the code a comment was written on when the diff can no longer place it, and going to it says the diff no longer has that line.

- fix(report): A bug report names the cursor's row with the same number it marks that row with in the code around the cursor.

- fix(diff): A thread's stand is drawn as one circle at one size, `○ ◎ ◉ ●`, where the quarter-filled and half-filled circles were drawn at sizes of their own.
