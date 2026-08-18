## 0.1.0-alpha.82

### Minor Changes

- A reviewer can write back to an answer. Press `R` on a thread, in the diff or in the review panel, and the reply continues that thread rather than opening a second one about the same line. It reaches the agent through `comment take` like any other comment, carrying the conversation so far, and `adiff comment reply --to <id>` does the same from the command line.
