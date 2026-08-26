---
"@eliya-oss/agent-diff": patch
---

fix(diff): A stretch of code takes the first colour the highlighter gives it, so a `.tsx` file no longer paints tag names and identifiers as numbers where the highlighter answered with a name, a type and a constant for the same range.
