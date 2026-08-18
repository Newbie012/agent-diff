## 0.1.0-alpha.75

### Patch Changes

- The suite runs in three parts at once, so a change reaches a release in about half the time it took.

- Cmd and option in the compose box now do what they do everywhere else: cmd moves to the ends of a line or the draft, option moves by word, and a key held with a modifier is never typed. Letting go of shift after growing a selection opens the comment on it.

- The box a comment is written in is opentui's textarea now, rather than one written here: the caret is the terminal's own, and undo, selection, and word and line movement come with it. Cmd and option keys the box does not carry by default are added to it.
