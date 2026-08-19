---
"@eliya-oss/agent-diff": patch
---

`L` in the review asks the agent for a reading order. If the branch has none it asks for one, if the one it has describes an older commit it says so and asks for a fresh read, and otherwise it asks for a revision. The request arrives as an ordinary comment, so the agent picks it up the way it picks up everything else.
