---
"@eliya-oss/agent-diff": patch
---

fix(layers): Marking a file read on one layer no longer marks it read on the others. Where several layers claim one file, `m` records the layer's own runs, and the file counts as read once every layer's runs of it are read.
