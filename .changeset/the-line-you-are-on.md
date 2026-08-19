---
"@eliya-oss/agent-diff": patch
---

The line under the cursor keeps its colour. It used to be repainted a flat grey with a bright blue gutter, so on the one line you were looking at you could not tell whether it had been added or deleted — the `+` sat at 1.18:1 against its own background. The cursor now lifts the line's own tint instead of replacing it. Comment bodies are no longer the dimmest text on the screen: they were 3.9:1 while the agent's narration beside them was 8.2:1, which had it backwards.
