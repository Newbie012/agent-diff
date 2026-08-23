---
"@eliya-oss/agent-diff": patch
---

fix(diff): a comment stays on its line when the agent edits that line by a few characters.

<details><summary>What was wrong</summary>

A comment was placed by matching its snippet exactly, so making the small edit the comment asked for
took the comment off the diff along with the old wording. Asking for `seed: (driver, network)` to
become `seed: ({ driver, network })` cost the reviewer both the comment and the answer to it: the
thread was answered, but only the review panel showed it. A line that is nearly the same — at most
one character changed in four — now keeps the comment. A short line still has to match exactly, so
nothing lands on a stray brace, and code the agent genuinely replaced still goes to the panel.

</details>
