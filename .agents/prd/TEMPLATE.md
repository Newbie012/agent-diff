# PRD-NNN — Title

> One-sentence summary the reader can scan to know whether to keep reading.

- **Status:** `draft` | `review` | `accepted` | `superseded by PRD-XXX`
- **Owner:** TBD
- **Last updated:** YYYY-MM-DD

## Problem Statement

The problem, from the perspective of whoever feels it: the reviewer, the agent in the worktree, or
the operator running adiff.

Do not name modules, helpers, or file paths here.

## Solution

The behavior adiff provides. What the reviewer sees, what the agent receives, what adiff refuses.

Two or three short paragraphs. Contracts go in **Implementation Decisions**; steps go in
GitHub issues.

## User Stories

> As a `<actor>`, I want `<capability>`, so that `<benefit>`.

Cover the relevant cases:

1. Happy path.
2. Empty result — nothing to review, nothing waiting.
3. Refusal — the request cannot be honoured without guessing.
4. Stale state — the code moved under the reviewer or the agent.
5. Restart — adiff, the agent, or both went away and came back.

## Implementation Decisions

### Owns

The behavior this PRD owns.

### Does not own

Nearby behavior owned by another PRD, ADR, or issue.

### Public contract

Inputs, outputs, error tags, exit codes, key bindings, or guarantees a reader can depend on.

### Deferred decisions

Any decision intentionally left open, and the trigger that resolves it.

Do not include file paths, helper names, or step-by-step plans. Those go in GitHub issues.

## Testing Decisions

What "verified" means for this PRD.

Required:

- Which of the two boundaries in [PRD 008](008-tests-and-drivers.md) the behavior is observed at.
- The TestDriver sub-drivers involved.
- The behaviors that must be covered, framed as outcomes.

Tests assert on what a reviewer or an agent can observe. Never on an internal call.

## Out of Scope

Behaviors a reader might expect this PRD to cover but it does not. Link the owning PRD, ADR, or
issue when one exists.

## Further Notes

Only stable notes belong here. Temporary implementation notes go to GitHub issues.
