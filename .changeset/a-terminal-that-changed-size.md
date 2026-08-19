---
"@eliya-oss/agent-diff": patch
---

Making the terminal smaller no longer blanks the review for good. Every panel kept its old width, the draw underneath failed, and nothing was drawn again until adiff was restarted. Mark-and-go-to-next also stopped un-marking a file that was already reviewed.
