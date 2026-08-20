---
"@eliya-oss/agent-diff": patch
---

A file whose name is not plain ASCII is in the review. git quotes such paths by default, adiff could not read the quoted form, and the file was dropped from the diff entirely — absent from the tree, absent from the count, unreachable by `]`, with nothing saying so. `layers set` reported it to the agent as vanished while it existed, and with layers set the same diff reported one more file than without.

Two things introduced earlier today are also fixed. A layer whose files you have all read stopped saying so once `f` hid them — the tick reverted and the layer looked unstarted, because the tally counted the visible files rather than the layer's own. And the leftover layer could say "0 runs of changed lines the layers do not account for" while listing a file; it now says what is actually left over.
