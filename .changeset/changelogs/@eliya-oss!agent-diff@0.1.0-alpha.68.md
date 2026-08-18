## 0.1.0-alpha.68

### Minor Changes

- A comment goes to the agent when it is written. Staging one for a review sent later is gone, with the screen that listed what was held back: `comment stage`, `comment edit` and `review send` are removed, `ctrl+s` in the compose panel is the only way out, and `comment send` is the only way to send.

### Patch Changes

- Colours land on the words they belong to: a file edited after the review opened no longer draws old colours over new lines. Loading a grammar no longer holds up the keyboard. The wheel over the file list moves the list, rather than opening each file it passes.

- Dragging over lines in the diff copies them when the drag ends, and they stay selected. `y` copies the line the cursor is on without selecting first, or the whole answer when the cursor is on one. On a Mac the text reaches the pasteboard even when the terminal drops the escape.

- A comment taller than the screen is walked a page at a time, rather than stepped over in one press. The wheel carries on from where the pane is: the first notch after scrolling past a comment no longer jumps somewhere else.
