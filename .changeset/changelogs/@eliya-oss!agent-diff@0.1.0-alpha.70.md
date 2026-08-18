## 0.1.0-alpha.70

### Patch Changes

- The published binary is attached to the release compressed as well as raw, and Homebrew and `adiff upgrade` both take the compressed one. An install downloads about 25MB rather than 73MB, and unpacks to the same binary.

- Dragging over the code itself copies it, not only over the line numbers. Turning to another file starts at the top of it rather than keeping where the last one was scrolled to. A bug report names the adiff version it came from.
