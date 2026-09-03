# Context — adiff glossary

The vocabulary every PRD reuses. Add a term here when a PRD introduces one; never invent a synonym
in a PRD for something already named below.

adiff keeps this list short deliberately. A review tool accumulates near-synonyms fast — lane,
chapter, walkthrough, tray — and each one costs the reader a translation.

Entries are ordered alphabetically within each section.

---

## People

### Reviewer

The engineer reading the diff. One person, running several agents in parallel worktrees of one
repo. Everything adiff shows is for them; everything adiff sends is from them.

### Agent

The coding agent still sitting in the worktree being reviewed. It receives comments and answers
them with work, not with prose. It is a consumer of adiff, never a user of the terminal.

### Operator

Whoever configures adiff: the runtime, the store root, where the skill is installed. In practice
the same person as the reviewer, but the concerns are separate.

---

## Review

### Anchor

What a [comment](#comment) is attached to: [file path](#patch) + [side](#side) + line range +
[blob](#blob) + the exact snippet that was selected. An anchor carries enough for the agent to act
without opening the file, and enough to tell later that the code moved.

### Branch

A git worktree and the ticket branch checked out in it. The unit of review. adiff never says
"worktree" in user-facing text; the reviewer thinks in branches.

### Comment

An anchored note written by the reviewer, belonging to one [branch](#branch).

### Remark

An anchored remark on the [branch](#branch)'s pull request, read from the forge rather than written
in adiff. It carries the handle that left it, which may be the reviewer's own, and every reply in
its thread. The reviewer triages it; it reaches the agent only as a [comment](#comment) the reviewer
accepted.

### Review

A set of comments submitted together as one hand-over to the agent.

### Settle

The reviewer's act of closing a [thread](#thread), because the point was addressed and needs nothing
more. Settling folds the thread on screen and retires the comment, so the agent stops being handed
it. Only the reviewer settles: an agent can answer, and can say its answer asks something, but it
cannot close the point it was answering. Removing a comment retires it the same way, and says the
reviewer should not have made it.

### Side

Which version of the file a line number refers to: `new` for the working tree, `old` for the
version being replaced. A range on the new side never selects removed lines, and the reverse.

### Thread

One [comment](#comment) and everything said since: the agent's answers and the reviewer's replies,
oldest first. It is what the reviewer acts on rather than the comment underneath — one stop for the
cursor, [settled](#settle) or removed whole.

### Vouched

A file the reviewer marked as reviewed, recorded against the [blob](#blob) it was reviewed at. When
the agent rewrites the file the blob changes and the vouch lapses on its own — nothing has to
notice or invalidate it.

---

## Diff

### Blob

The git object SHA of a file's contents on the branch side of the diff. adiff uses it as the
staleness signal: same blob means the reviewer and the agent are looking at the same bytes.

### Gap

A run of file lines a [patch](#patch) leaves out: above its first [hunk](#hunk), between two of
them, or below the last. A gap knows how many lines it holds back and can hand them back a chunk at
a time without touching any other gap.

### Hunk

A contiguous `@@` group within a [patch](#patch). The unit of coverage.

### Patch

One file's changes within a [branch](#branch): header lines, hunks, and rows.

### Row

One line of the rendered diff, counted from the start of the patch. The coordinate space the
terminal moves the cursor in. Rows and file line numbers are different things and are converted in
exactly one place — see [PRD 002](002-diff-and-anchoring.md).

### Reindent

A removed [row](#row) and an added row in one [hunk](#hunk) that carry the same text once their
leading whitespace is set aside. The line moved sideways, and nothing in it changed. The terminal
washes both rows dimmer than a real change, so a block wrapped in a new function reads as one wrapper
and not as a rewrite of every line inside it.

---

## Delivery

### Inbox

The append-only record of everything submitted for one [branch](#branch). The reviewer writes to
it, the agent reads from it, and neither has to be running for the other to work.

### Store

Where review state lives on disk: the [inbox](#inbox), the agent's answers, the
[vouches](#vouched), and which [threads](#thread) are settled, removed or read. Rooted at
`~/.adiff` by default, overridable with `ADIFF_ROOT`.

### Take

The agent's act of collecting every comment it still owes an answer. A comment comes back on every
take until it is retired: answered by the agent, or [settled](#settle) or removed by the reviewer.

---

## Layers

### Layers

An agent-authored reading order over the same diff — a beginning, a middle, an end — instead of
alphabetical file order. Optional, versioned, and pinned to a commit, so a reader can tell when the
layers describes code that has since changed.

### Coverage

How much of a [branch](#branch)'s rows a [layers](#layers) accounts for. A layers that skips half the
diff is worse than no layers, because it reads as complete.
