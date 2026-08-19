---
"@eliya-oss/agent-diff": patch
---

`layers set` says which layer it would not take and why, instead of one sentence for five different mistakes. Spans that end before they start, or start before line one, are refused rather than dropped in silence; a layer given both spans and blocks keeps both; `./src/one.ts` is the same path as `src/one.ts`; and `layers show` reports covered, partial and vanished for each layer, not only for the document as a whole.
