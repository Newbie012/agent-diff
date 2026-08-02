# adiff — product requirements

## Problem

An agent finishes work in a git worktree. Reviewing it means `cd`-ing in, running `git diff`,
reading unhighlighted output, then describing the problem back in prose: "in incidents.ts around
the fetch, you're not handling 404". Both sides reconstruct the line reference by hand. That
round-trip is the bottleneck, not the fixing.

With several worktrees in flight the cost multiplies, and there is no way to see which branch is
waiting on you.

## Users

One engineer, running several agents in parallel worktrees of one repo.

## Outcomes

A review is finished when every hunk has been either vouched for or commented on, and every comment
has reached the agent that wrote the code.

| Outcome | Measure |
| --- | --- |
| A comment carries its own anchor | No prose location description is ever needed |
| The agent receives it with full context | The live session in that worktree handles it, not a fresh process |
| Review progress is durable | Closing the tool loses nothing |
| A stale anchor is never silently wrong | Code moving under a comment is visible before it misleads |

## Scope

### In

- Discover worktrees of a repo, with diff size and review state
- Read a branch diff: merge base against the working tree
- Select lines by keyboard or mouse, comment, submit singly or as a batch
- Track which files have been reviewed, invalidated when the agent rewrites them
- Deliver comments to the live agent session in that worktree
- Stream the agent's progress and replies back beside the comment

### Out

- Editing code
- Any git operation that writes (commit, push, merge)
- Hosting, sharing, or multi-user review
- Anything for a repository you do not have on disk

## Constraints

- Terminal only
- Must handle a 90-file, 8000-line diff without the reviewer waiting
- Review state must survive the tool, the branch, and the agent restarting
- The store is the contract between tool and agent; neither may assume the other is running

## Non-goals

Replacing GitHub review. This is for code that has not been pushed yet, written by an agent that is
still at the keyboard.

## Riskiest assumptions

1. Comment-to-agent delivery is worth more than the diff viewer alone. If false, this is a worse
   `git diff`.
2. An agent's narrated reading order beats file order. Unproven; gated behind the store having one.
3. Line anchors survive agent edits often enough to be useful. Mitigated by blob-SHA staleness.
