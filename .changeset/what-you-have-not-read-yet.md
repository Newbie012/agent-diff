---
"@eliya-oss/agent-diff": patch
---

An answer stays unread until you open it. Which answers you had seen lived only in the session, so reloading the branch to pick up an answer cleared the very marks that told you what was left — the one action guaranteed to lose your place. The panel counts what is unread, keeps the count across a reload, and drops it for a comment when you open that comment.

A bug report now carries what led to it: the last twenty moves, each with the screen, pane, row and file it was made on. The state alone was always captured after the fact, so the sequence had to be guessed. `ctrl+t` sends a minimal report instead — the words you typed and nothing else, no file names, no code, no key history.

Keys work on a keyboard that is not English. Pressing the key where `s` sits on a Hebrew layout sent a letter bound to nothing, so the review answered to none of its keys. Terminals that speak the kitty keyboard protocol report the key under the letter, and that is what a binding matches now. Typing is untouched: what reaches a comment is still the letter you typed.
