---
"@eliya-oss/agent-diff": patch
---

An option value that begins with two dashes is kept rather than thrown away. `--body "--force is risky here"` used to store the word `true` and report success, so the comment the reviewer wrote was silently replaced. Options can also be written as `--name=value`.

adiff now refuses what it used to swallow: an option a command does not take, a `--side` that is neither `old` nor `new`, a line number that is not a whole number, and a `--fields` name the answer does not carry. Each refusal names what was given and what is allowed. `--fields` itself is now listed by `adiff describe`, and the nine failures that used to report "Unexpected failure, try again" — an unreachable forge, a git command that failed, a store file that could not be read — say what actually went wrong and that retrying will not help.
