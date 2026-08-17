---
"@eliya-oss/agent-diff": patch
---

Comments handed to an agent that never answered them are no longer lost. The cursor advanced the moment `comment take` read a comment, so an agent that collected five and answered three left two that nothing would ever hand over again — and the terminal went on showing them as sent, with no sign anything was wrong. An answer is what retires a comment now, so one the agent dropped comes back on its next take and keeps coming back until it is answered. Settling or removing retires it too, since both are the reviewer saying they no longer need one. The branch list counts what the agent still owes rather than what it has yet to read, which is the number that was missing when a comment went quietly missing.
