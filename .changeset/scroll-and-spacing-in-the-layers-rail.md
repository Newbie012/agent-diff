---
"@eliya-oss/agent-diff": patch
---

fix(layers rail): a wheel over the rail still moves a file at a time, but stops when you do.

<details><summary>What was wrong</summary>

Each tick was queued behind a file load, so a trackpad flick left a backlog that carried on walking the review long after the gesture ended. Ticks that arrive while a move is still loading are dropped rather than queued.

</details>

fix(layers rail): the rail's three levels step in evenly, and a directory too long for the rail is shortened rather than cut off.

<details><summary>What was wrong</summary>

A directory sat one column left of the layer title above it and two right of the file names below it — three ragged edges. The file tree already lined its levels up; the rail does now too.

</details>
