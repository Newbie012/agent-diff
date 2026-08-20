---
"@eliya-oss/agent-diff": patch
---

Caches that outlived the process now live inside the layer that owns them, so a reload after the agent commits reads the real base rather than one remembered from earlier. The store's rename guard was set before the rename it guards, so a second reader could take the path the file had just left; it is a proper cache now, and a second reader waits.

Child processes are killed when the work that started them is interrupted. Leaving the review used to leave `gh` running behind it, and a cancelled upgrade could orphan a long install.

A truncated session file no longer crashes the terminal on launch, the store encodes what it writes through the same schema it decodes what it reads with, and several closed unions became switches so that adding a case fails the build rather than falling through.
