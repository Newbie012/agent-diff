## 0.1.0-alpha.55

### Patch Changes

- The review screen says which pane you are in. It was one frame around everything with rules between the panes, which drew the seams but never told you which side of them your next keystroke was going to land on — and `tab` moves between three panes where most keys mean something different. Each pane is its own bordered box now, and the one holding the focus is lit in the accent colour while the others stay dim, so exactly one border is bright at any time. `tab` also walks the panes left to right now, the way they are drawn, rather than starting in the middle and jumping to the left pane before crossing to the right; `shift+tab` walks back.
