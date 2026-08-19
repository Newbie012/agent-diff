## 0.1.0-alpha.109

### Patch Changes

- The line under the cursor, and the lines in a selection, keep their colour. It used to be repainted a flat grey with a bright blue gutter, so on the one line you were looking at you could not tell whether it had been added or deleted — the `+` sat at 1.18:1 against its own background. The cursor and the selection now lift the line's own tint instead of replacing it, and the line numbers were lifted out of the 1.6:1 they sat at on a tinted row. Comment bodies are no longer the dimmest text on the screen: they were 3.9:1 while the agent's narration beside them was 8.2:1, which had it backwards.

- The two counters in the header no longer look like the same number. `2/14  3/14 reviewed` put a position and a progress fraction two spaces apart in one colour, with different denominators when a file sat in more than one layer. They now read `file 2 of 14` and `3 reviewed`.

- An option value that begins with two dashes is kept rather than thrown away. `--body "--force is risky here"` used to store the word `true` and report success, so the comment the reviewer wrote was silently replaced. Options can also be written as `--name=value`.

  adiff now refuses what it used to swallow: an option a command does not take, a `--side` that is neither `old` nor `new`, a line number that is not a whole number, and a `--fields` name the answer does not carry. Each refusal names what was given and what is allowed. `--fields` itself is now listed by `adiff describe`, and the nine failures that used to report "Unexpected failure, try again" — an unreachable forge, a git command that failed, a store file that could not be read — say what actually went wrong and that retrying will not help.

- Four things a bug bash of the review terminal turned up.

  Copying a selection that crosses a change put both versions of every changed line on the clipboard, so the paste was code that existed in neither version of the file. It now copies the version being kept, and still copies deleted lines when that is all you picked.

  A comment you were part way through writing is no longer thrown away when the box closes. Escape or ctrl+c keeps it, and reopening on the same lines brings it back. A comment of nothing but spaces is refused with a message instead of reaching the agent as an empty thread.

  A terminal too narrow to draw the review in used to leave it blank for good, with no way back short of restarting. It says it needs more room, and comes back when the terminal does.

- Wrapped lines follow the pane when it grows. Hiding the rails with `z` widened the diff from 66 columns to 148 and the text kept breaking at 62, so the one key that buys the most room did nothing for anyone reading with wrapping on.
