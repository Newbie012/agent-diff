# Reading the command surface back

Twenty-one verbs grew a week at a time and nobody had looked at them together. This is that look:
what holds up, what does not, what is worth changing, and what is only worth renaming if you enjoy
renaming things.

The conclusion up front: **the nouns are mostly fine, the audiences are not separated, and the help
was broken.** The gap that costs users the most is not taxonomy, it is that a person who types a
command name and `--help` gets a JSON error. Most of the work here is that. The taxonomy notes are
recorded so the next person does not have to re-derive them.

## What was actually broken

Help only existed at the top. Every level below it fell through to the agent-facing path:

```
$ adiff comment --help
{"ok":false,"error":{"name":"comment","known":["branch list","comment add", … 21 names …],"type":"UnknownCommand", …}}

$ adiff comment take --help
{"ok":false,"error":{"option":"worktree","type":"MissingOption","retriable":false,"suggestion":"Run `adiff describe --command <name>` for the options it requires."}}
```

The second one is the worse of the two. A person asking what a command does is told they used it
wrong. The information existed the whole time: `adiff help comment take` printed a decent page, and
`describe --command 'comment take'` returned the same as JSON. Both require knowing a spelling
nobody guesses. `--help` is the spelling everybody guesses.

## The audience question

This surface has two callers and they want opposite things.

An agent wants one compact line of JSON, failures on stderr, exit codes it can branch on, and a
machine-readable catalog. It pays per token, so every byte printed for a human's benefit is a tax.

A person wants prose, grouping, examples, and a `--help` that works everywhere.

The existing answer was to serve the agent and let the person cope. The tempting fix is to sniff
for a tty and print prose when attached to one. **That is rejected.** Output that changes shape
depending on whether a pipe is attached is the classic way to make a CLI untestable and to break a
caller that redirects. PRD-007 already deferred a `--json`/`--human` split for the same reason.

The rule adopted instead is narrower and mechanical:

> **Prose is printed when, and only when, help was asked for.** Everything else answers in the
> envelope, whoever is watching.

So `--help`, `-h`, `help <command>`, and bare `adiff` print prose on stdout and exit 0. Every other
path keeps the JSON contract exactly as it was. There is no ambiguity about which you will get, and
no test has to pretend to be a terminal.

`upgrade` is the one command outside this rule, and it earns the exemption honestly: every other
verb exists to be called, `upgrade` exists to be typed, and its answer is about the installation
rather than about the repository. It prints prose and takes `--json` for the envelope. That is one
named exception, decided per command, not a shape that changes under a pipe.

This leaves one uncomfortable case, and it is deliberate. `adiff comment` with no verb still answers
in JSON on stderr with exit 2, because it is a malformed invocation and an agent parses it. It is
now a useful failure: it carries the group's verbs and the suggestion points at `adiff comment
--help` rather than at `describe`. A person who wanted to browse gets a JSON line with the right
next command in it, which is worse than prose and better than a wall of twenty-one names.

## Do the nouns hold up

Mostly, and the exceptions are cheaper to live with than to rename. A published surface that the
skill and `adiff init` both teach does not get renamed to satisfy a taxonomy.

**`comment threads` returns threads, not comments.** True, and it is the one name that reads as a
noun where every sibling reads as a verb. `comment list` would be the right name, sitting beside
`branch list`. The rename is cheap in code and not cheap in the world: it is in the skill, in
AGENTS.md files already written into other people's repositories, and in the published catalog.
**Left alone**, recorded here so the next reader knows it was seen rather than missed. If it is ever
renamed, `comment threads` stays as an alias forever and the `threads` data key does not move.

**`add` versus `stage`.** These differ in a way the names do not carry: `add` files a comment and
delivers it immediately, `stage` puts it in a review that `review submit` sends as one batch. A
caller who guesses gets the wrong behaviour silently. `send` and `stage` would be the honest pair.
**Left alone** for the same reason as above, but the fix that matters is done: both now have real
help pages, and the difference is the first line of each.

**`drop` versus `remove`.** Also close, also genuinely different: `drop` withdraws something not yet
sent, `remove` withdraws something already delivered and keeps it in the record. Two words for two
lifecycle stages is correct. `restore` pairs only with `remove`, which is fine. **Left alone.**

**`file vouch` is one verb under a lonely noun.** `vouch` is unusual English, but it is the word the
terminal uses on screen and in the footer, so the CLI matching the UI is worth more than the CLI
matching a dictionary. A noun with one verb is not a problem; it is room. **Left alone.**

**`review` carries three unrelated things.** `review submit` sends comments, `review progress`
reports counts, `review open` and `review pane` start a terminal. The obvious consolidation is
`review open --pane`, retiring `review pane`. **Rejected**, and this is the one I feel strongest
about: `review open` hands the terminal to the reviewer and prints no JSON at all, while `review
pane` answers with an envelope carrying `opened`, `pane` and `command`. Merging them produces a
single command whose output convention depends on a flag, which is exactly the shapeshifting the
tty rule above exists to prevent. Two commands, two conventions, one of each. Correct as it stands.

## The seam that is real

Reviewer-side commands address a review by `--repo` and `--branch`. Agent-side commands address the
same review by `--worktree`. A caller has to know which, and the two vocabularies never meet.

The concrete cost: an agent runs `comment take --worktree .`, gets comments, and wants
`comment threads` next to see whether any are already settled. `comment threads` wants `--repo` and
`--branch`, and nothing in the answer it just received tells it either. It has to shell out to git
to work out where it is.

This is a seam in the model, not a missing flag, and the smallest honest repair is to make the
answer say where it came from. `comment take` now reports the `branch` it collected for alongside
the comments, so the next command in the sequence can be constructed from the previous answer
instead of from `git rev-parse`.

The larger repair, accepting `--worktree` anywhere `--repo --branch` is accepted, is **deferred**.
It is additive and safe, but it doubles the addressing vocabulary on eleven commands, and the value
of doing it should be judged after seeing whether reporting the branch was enough.

## What an agent was missing

The catalog is machine readable and lists twenty-one verbs in an order that means nothing. An agent
handed that list has to infer a sequence from it, which is the one thing a flat list cannot carry.
Bare `adiff` teaches the sequence in prose, but an agent reading `describe` never sees it.

So every command now carries a `group` in the catalog, naming the part of the loop it belongs to:
discovery, writing comments, answering them from the worktree, following up, and setup. It is one
short string per command, it costs an agent almost nothing, and it turns the catalog from a list
into something with a shape. The same groups order the human help, so the two views agree.

## What should be removed

Nothing. Every verb has a caller, and the two that look redundant in pairs are not. A surface this
young with this few users is not where dead weight accumulates; it is where it looks like dead
weight because nobody has used it yet.

## What would break

Nothing. Every existing invocation still works and answers what it answered. The changes are:
prose on paths that previously errored, extra fields inside existing error envelopes, one extra
field on the `comment take` answer, one extra field per catalog entry, and a bare `adiff --fields`
now printing the banner instead of reporting an unknown command named the empty string.

There is no migration, because nothing moved.
