# PRD-010 — Feedback capture

> A key that turns "this is broken" into a report someone can act on, without leaving the terminal.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-03

## Problem Statement

adiff is early and it breaks. When it does, the reviewer is mid-review with a screen full of
context — a branch, a file, a cursor, a sequence of keys that got them here — and the only way to
report it is to leave, remember what they did, and describe it in prose. Everything needed to
reproduce it is on screen at the moment it happens and gone a moment later.

The reviewer should not have to be a good bug reporter. They should be able to say what went wrong
in their own words and have the surrounding facts collected for them.

## Solution

`ctrl+b` opens a report. The reviewer types what happened, in whatever words they like, and sends
it. adiff writes the description together with everything it knows about the moment — the branch,
the file, the cursor, the screen as rendered, the keys pressed to get there, the runtime, and the
last internal failure if there was one — to a file, and copies the same text to the clipboard so it
can be pasted into a message or an issue without hunting for it.

Nothing is sent anywhere. The report is a local file and a clipboard entry; where it goes next is
the reviewer's decision.

## User Stories

1. As a `reviewer`, I want to describe a bug in my own words while looking at it, so that the
   report happens at the moment I have the context rather than an hour later.
2. As a `reviewer`, I want the surrounding facts gathered for me, so that a useful report costs one
   key rather than ten minutes of recall.
3. As a `reviewer`, I want the report on my clipboard, so that pasting it is the whole remaining
   effort.
4. As a `reviewer` over ssh, I want the report on disk as well, so that a clipboard that cannot
   reach my machine does not lose the report.
5. As `whoever fixes it`, I want the keys pressed and the screen as rendered, so that I can
   reproduce it without a conversation.
6. As a `reviewer`, I want to abandon a report I started, so that pressing the key by mistake costs
   nothing.

## Implementation Decisions

- **A report carries everything on the screen, and `ctrl+t` sends the least instead.** What is hard
  to act on in a report is not missing fields but a missing sequence: the state is captured after
  the fact, so what led there has to be guessed. A full report carries the last twenty moves with
  the screen, pane, row and file each was made on. A minimal one carries the words the reviewer
  typed and nothing else — no file names, no code, no key history — for a report about work that
  cannot leave the machine.

### Owns

The report screen, what a report contains, where it is written, and how it reaches the clipboard.

### Does not own

The keys themselves ([PRD 003](003-review-terminal.md)); the store's root
([PRD 009](009-runtime-and-configuration.md)).

### Public contract

- **`ctrl+b` from the branches list or a review** opens the report screen. `ctrl+s` sends it,
  `esc` abandons it. It is a text screen, so every printable key reaches the description
  ([PRD 003](003-review-terminal.md)).
- **A report is markdown**, in this order: the reviewer's description first, because that is the
  part a human reads; then the facts.
- **The facts are** the adiff version, the Node version and platform, the terminal size, the repo,
  the branch, the file and cursor position, the screen the reviewer was on, the counts of staged
  and reviewed files, the last internal failure if one occurred, the last keys pressed, and the
  screen as rendered.
- **The last 40 keys are recorded** as their binding names where one exists and their raw name
  otherwise, oldest first. Text typed into a description is not recorded — a report should not
  contain what the reviewer typed into an unrelated comment.
- **Reports are written to `<root>/reports/<timestamp>.md`** and the path is shown on screen.
- **The clipboard is written over OSC 52**, so it works through ssh and tmux. A clipboard that
  fails is not an error: the file is the durable copy and the notice says where it is.
- **An empty description is refused.** A report with no words is worse than none, because it looks
  actionable and is not.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Sending the report anywhere automatically | A second person using adiff |
| Attaching the diff itself | A report where the change mattered and the paths did not identify it |
| Recording a longer key history, or timings | A bug that the last 40 keys do not explain |

## Testing Decisions

Observed at the store boundary: the report file is read back and asserted on, through the driver.
The clipboard cannot be observed from a test and is not asserted; the file is the contract.

Behaviors that must be covered:

- A described report is written, and contains the description.
- It contains the branch, the file and the keys that led there.
- An empty description is refused and writes nothing.
- Abandoning a report writes nothing.

## Out of Scope

- Sending reports to a service, an issue tracker, or a chat.
- Redacting the report. It contains a rendered screen of the reviewer's own code, which they
  already have on screen; it is theirs to read before pasting.
- Recording anything when adiff is not running.

## Further Notes

The description comes first in the file on purpose. Everything after it is context that a reader
skims; the sentence the reviewer wrote is the part that says what is wrong.
