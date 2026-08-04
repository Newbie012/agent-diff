## 0.1.0-alpha.0

### Minor Changes

- Mark files reviewed from the terminal, with progress in the header and the tree.

- Fix the render crash on large diffs; the terminal now owns scrolling. Expandable context, and simulator variants.

- Review what is staged before sending it, and send the batch from the terminal.

- Navigate a long diff: g/G, half-page scroll, and hunk jumps.

- Separate panes with a rule, switch focus with tab, and zoom the diff.

- Sticky scope: the whole enclosing chain, read from the file rather than the diff.

- Compose shows the code being commented on, takes multiple lines, and can stage.

- Review a diff by the argument instead of the filesystem. An agent writes a story over its own
  worktree with `adiff story set`, and the review terminal lists its numbered steps in place of the
  file tree, scoping the diff to the step you are on. adiff computes coverage itself, so the hunks no
  step claims are reported by `adiff story show` and shown to the reviewer under "not in any step".

- Own the diff rendering: one parse per file, no highlight flash on scroll.

- First alpha of the review terminal and the agent hand-over.

- File tree navigation, and GitHub-style review batching with comment stage / review submit.

- The branch list shows which branches have work waiting, and refreshes when you return to it.

- Simulate large branches, and keep the file list usable at that size.

- Per-directory tree folding, with crowded directories closed on open.

- Mouse wheel scrolling, drag selection, and a file tree that reads like the prototype's.

- ctrl+b writes a bug report with the surrounding context and copies it to the clipboard.

- Command palette and sticky scope in the review terminal.

- Agent-readable command surface: noun-verb commands, compact JSON, failures on stderr with actionable exit codes, --fields projection, and describe.

### Patch Changes

- The pinned scope lines up with the code it names.

- Every letter is typeable in a comment, and commented lines are marked in the gutter.

- A coherent theme: fewer hues, more contrast levels, semantic names.

- Footer chips with key glyphs, a selection readout, and messages that expire.

- Pin the right scope, align the sign column and the tree, and say when lines are hidden.

- The pinned scope keeps its syntax highlighting; the simulator ships with comments already on it.
