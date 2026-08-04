# PRD-000 — adiff overview and PRD index

> What adiff is for, which PRD owns which behavior, and the concerns every PRD inherits.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

## Problem Statement

An agent finishes work in a git worktree. Reviewing it means `cd`-ing in, running `git diff`,
reading unhighlighted output, and then describing the problem back in prose: "in incidents.ts
around the fetch, you're not handling 404". Both sides reconstruct the line reference by hand. That
round-trip is the bottleneck, not the fixing.

With several worktrees in flight the cost multiplies, and there is no way to see which branch is
waiting on the reviewer.

## Solution

adiff is a terminal where the reviewer reads a branch's diff with syntax highlighting, selects
lines, and writes a comment. The comment is filed against that worktree with its own anchor. The
agent in that worktree collects it and acts on it. No pull request, no browser, no line numbers
retyped into chat.

Everything the terminal does is also a command, so no behavior is reachable only through the UI.

## Outcomes

A review is finished when every file has been vouched for or commented on, and every comment has
reached the agent that wrote the code.

| Outcome | Measure |
| --- | --- |
| A comment carries its own anchor | The agent never needs a prose location description |
| The agent receives it with full context | The snippet travels with the comment; no second lookup |
| Review progress is durable | Closing the terminal loses nothing |
| A stale anchor is never silently wrong | Code moving under a comment is visible before it misleads |

## User Layers

1. As a `PRD author`, I want one page that says which PRD owns a behavior, so that I don't
   redefine it in mine.
2. As an `implementing engineer`, I want the module map, so that I can place new code without
   re-reading every PRD.
3. As a `reviewer of a PRD`, I want the list of concerns every PRD inherits, so that I can spot an
   omission quickly.

## Implementation Decisions

### Runtime shape

```text
        reviewer
           │  keystrokes
           ▼
   ┌────────────────────┐
   │  Review terminal   │  PRD 003
   └─────────┬──────────┘
             │ same commands the CLI exposes
             ▼
   ┌────────────────────┐      ┌────────────────────┐
   │  Command surface   │◄─────┤ Branch discovery   │  PRD 001
   │  PRD 007           │      └────────────────────┘
   └─────────┬──────────┘      ┌────────────────────┐
             │                 │ Diff and anchoring │  PRD 002
             │◄────────────────┤                    │
             │                 └────────────────────┘
             ▼
   ┌────────────────────┐      ┌────────────────────┐
   │       Store        │◄─────┤ Vouching, progress │  PRD 005
   └─────────┬──────────┘      └────────────────────┘
             │  take
             ▼
   ┌────────────────────┐
   │  Agent in worktree │  PRD 004
   └────────────────────┘
```

### Index

| PRD | Owns | Module |
| --- | --- | --- |
| [001](001-branch-discovery.md) | Which branches have something to review, and how much | `service/git` |
| [002](002-diff-and-anchoring.md) | Parsing a diff into rows and hunks; turning a selection into an anchor | `domain/patch` |
| [003](003-review-terminal.md) | The terminal: navigation, selection, composing a comment | `tui` |
| [004](004-comment-delivery.md) | Filing a comment and handing it to the agent exactly once | `service/store` |
| [005](005-vouching-and-progress.md) | Marking a file reviewed, and what lapses when the code changes | `domain/review` |
| [006](006-layers-review.md) | Reading a diff as an agent-authored layers | `domain/layers` |
| [007](007-command-surface.md) | The command contract: subcommands, envelope, exit codes | `cli`, `main.ts` |
| [008](008-tests-and-drivers.md) | What "verified" means, and the TestDriver every test speaks through | `testing` |
| [009](009-runtime-and-configuration.md) | Runtime requirements, store root, installing the agent skill | root |
| [010](010-feedback-capture.md) | Reporting a bug from inside the terminal, with the context attached | `tui`, `service/store` |

### Cross-cutting concerns every PRD inherits

- **Two observable boundaries, and no others.** A behavior is verified at the terminal screen or
  at the store. See [PRD 008](008-tests-and-drivers.md).
- **Every command answers in one JSON line**, `{"ok":true,…}` or `{"ok":false,"error":{"_tag":…}}`
  with a non-zero exit. See [PRD 007](007-command-surface.md).
- **Errors are named for what went wrong**, never for an HTTP-shaped category. `UnknownBranch`
  carries the branches that do exist; `UnselectableRange` carries the range that was asked for.
- **Nothing is reachable only through the terminal.** If the UI can do it, a command can do it.
- **Staleness is visible, never silent.** Anything anchored to code carries the [blob](CONTEXT.md#blob)
  it was anchored at.
- **The store is the contract between the terminal and the agent.** Neither may assume the other
  is running.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Whether layers earn their keep at all | [PRD 006](006-layers-review.md) shipping and being used on a real 90-file review |
| Streaming the agent's replies back beside the comment | A review where the reviewer wants a conversation rather than a hand-over |
| Multi-repo branch discovery | A second repo in regular use |

## Testing Decisions

This PRD owns no runtime behavior and has no tests. Every other PRD names its coverage, and
[PRD 008](008-tests-and-drivers.md) owns the shared rules.

## Out of Scope

- Editing code. adiff reads a diff and writes comments; it never writes source.
- Any git operation that writes: commit, push, merge.
- Hosting, sharing, or multi-user review.
- Any repository not on disk.
- Replacing GitHub review. adiff is for code that has not been pushed, written by an agent that is
  still at the keyboard.

## Further Notes

**The riskiest assumptions**, stated so they can be falsified rather than defended:

1. Comment-to-agent delivery is worth more than the diff viewer alone. If false, adiff is a worse
   `git diff`.
2. An agent's narrated reading order beats file order. Unproven — gated behind
   [PRD 006](006-layers-review.md).
3. Line anchors survive agent edits often enough to be useful. Mitigated by carrying the blob and
   the snippet, so a stale anchor announces itself.
