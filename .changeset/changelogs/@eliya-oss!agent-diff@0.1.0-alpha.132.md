## 0.1.0-alpha.132

### Patch Changes

- Five things the layers rail got wrong about where you are.

  Collapsing the layer you are reading took the cursor off the rail entirely — nothing said where you were, and the layer looked unstarted. A collapsed layer holding the cursor now carries it on its title row.

  After `r` picked up layers the agent had rewritten, the layer holding your file was collapsed, the rail had no cursor, and `l` did nothing at all, because both were still keyed to the layer index from before the reload.

  A first layer whose files are not in the diff — one bad path from the agent — opened the review at the *last* file of the reading order instead of the first.

  A file two layers both claim reported the position of its first appearance, so the counter read `file 1 of 3` at the end of the walk, and `]` looked dead on the press that moved between the two copies. The cursor bar was also drawn on that file in every layer naming it, so the rail could not say which layer you were reading.

  A layer whose spans name nothing in the diff drew a bare title with no explanation and lost its note. It now says what it was pointing at, and shows the note, since there is no file for the diff to carry it against.
