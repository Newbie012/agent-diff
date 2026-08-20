---
"@eliya-oss/agent-diff": patch
---

fix(layers rail): a wheel still moves a file at a time, but stops when you do.

<details><summary>What was wrong</summary>

Each tick was queued as its own task behind a file load, so a trackpad flick left a backlog that carried on walking the review long after the gesture ended. A tick that arrives while a move is still loading is dropped rather than queued. The file tree keeps every tick, since moving that list loads nothing.

</details>

fix(layers rail): titles, directories and file names step in evenly, the way the file tree already did.

<details><summary>What was wrong</summary>

A directory sat one column left of the layer title above it and two right of the file names below it — three ragged edges rather than a hierarchy. A directory too wide for the rail was also hard-cut at the pane edge, because the shortener could return something longer than the room it was given.

</details>
