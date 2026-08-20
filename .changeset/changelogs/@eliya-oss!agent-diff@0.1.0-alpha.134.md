## 0.1.0-alpha.134

### Patch Changes

- A wheel over the layers rail still moves a file at a time, but stops when you do. Each tick was queued behind a file load, so a trackpad flick left a backlog that carried on walking the review long after the gesture ended. Ticks that arrive while a move is still loading are dropped rather than queued.

  The rail's columns line up. A directory sat one column left of the layer title above it and two right of the file names below it — three ragged edges. The three levels now step in evenly, the way the file tree already did, and a directory too long for the rail is shortened rather than cut off at the pane edge.
