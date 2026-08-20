## 0.1.0-alpha.120

### Patch Changes

- Copying a selection that crosses a collapsed gap no longer puts adiff's own `⋯ 103 lines hidden` marker on the clipboard as if it were source. `y` also stops discarding a selection you made because the cursor happens to be resting on a comment — with a selection active it copies the selection.

  The two numbers on screen say what they count. The footer now reads `4 lines selected` and the toast `2 lines copied`, which is honest about the difference: a change shows both its old and its new line, and copy takes the one you are keeping.
