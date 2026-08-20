---
"@eliya-oss/agent-diff": patch
---

fix(layers rail): the wheel keeps working after a flick, and moves one file per notch.

<details><summary>What was wrong</summary>

The guard that stopped a trackpad flick running on past the gesture was never cleared when a move failed, so after one bad load the rail stopped answering the wheel entirely. It is cleared whatever happens now, and a notch that arrives mid-load is remembered rather than thrown away, so movement keeps up with the gesture instead of dropping out of it.

The wheel was also registered twice over the file list — once on the pane and once on the text inside it — so a single notch moved two files.

</details>
