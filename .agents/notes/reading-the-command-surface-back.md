# Reading the command surface back

Twenty-one verbs grew a week at a time and nobody had looked at them together. This is that look:
what holds up, what does not, and what changed.

The conclusion up front: **the help was broken, the addressing model was split in half, and four of
the names were wrong.** All of it is fixed. adiff is alpha, published under an alpha tag, with one
user. There is no catalog in the wild to keep working and no migration to write, so the only cost
of a rename is the rename, and a name that is wrong stays wrong for as long as you let it.

## What was broken about help

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

`--help` and `-h` are now read in any position, on a command, on a noun, and at the top. A command
prints its own usage, its options with the required ones marked, the shared `--fields`, its
example, and the key its answer sits under.

## The audience question

This surface has two callers and they want opposite things.

An agent wants one compact line of JSON, failures on stderr, exit codes it can branch on, and a
machine-readable catalog. It pays per token, so every byte printed for a human's benefit is a tax.

A person wants prose, grouping, examples, and a `--help` that works everywhere.

The existing answer was to serve the agent and let the person cope. The tempting fix is to sniff
for a tty and print prose when attached to one. **That is rejected.** Output that changes shape
depending on whether a pipe is attached is the classic way to make a CLI untestable and to break a
caller that redirects.

The rule adopted instead is narrower and mechanical:

> **Prose is printed when, and only when, help was asked for.** Everything else answers in the
> envelope, whoever is watching.

`upgrade` is the one command outside this rule, and it earns the exemption honestly: every other
verb exists to be called, `upgrade` exists to be typed, and its answer is about the installation
rather than about the repository. It prints prose and takes `--json` for the envelope. That is one
named exception, decided per command, not a shape that changes under a pipe.

This leaves one uncomfortable case, and it is deliberate. `adiff comment` with no verb still
answers in JSON on stderr with exit 2, because it is a malformed invocation and an agent parses it.
It is now a useful failure rather than a wall: it carries the noun's verbs, the suggestion points at
`adiff comment --help`, and the twenty-one-name catalog dump is gone.

## The seam that was real

Reviewer-side commands addressed a review by `--repo` and `--branch`. Agent-side commands addressed
the same review by `--worktree`. The two vocabularies never met.

The concrete cost: an agent ran `comment take --worktree .`, got comments, and wanted `comment
threads` next to see whether any were already settled. That command wanted `--repo` and `--branch`,
and nothing in the answer it had just received carried either. It had to shell out to git to work
out where it was standing.

This was a hole in the model, not a missing flag. A review **is** a worktree, which is checked out
on a branch; the store has always keyed by both. A reviewer at the main checkout knows the branch
and not the worktree path, and an agent knows the worktree and not the repository root. Both are
legitimate ways to name one thing, so both are now accepted everywhere:

```
adiff comment list --worktree .
adiff comment list --repo . --branch add-teammate-invitations
adiff comment take --repo . --branch add-teammate-invitations
adiff layers show --repo . --branch add-teammate-invitations
```

Neither spelling is primary. A command declares that it addresses a review, and the surface fills
in whichever half the caller did not give. `comment take` also reports the branch it collected for,
so the next command can be built from the previous answer.

## The names

**`comment threads` → `comment list`.** It was the one name that read as a noun where every sibling
read as a verb, and it now sits beside `branch list`. Its payload moved from `threads` to
`comments`, because a caller who asked to list comments should get comments; the answers hanging off
one are a field on it, not a different noun. There is no thread in the surface any more, which is
one fewer word to learn. It also now includes staged comments, marked `state: "staged"` — a command
called "every comment on a review" that silently omitted the ones you had just written was a lie,
and the rename is what made that obvious.

**`comment add` → `comment send`, and `review submit` → `review send`.** `add` and `stage` both
sounded like putting a comment somewhere; the difference was that one delivered immediately and the
other waited for a batch, and nothing in the names carried that. Now the verb is the same wherever
the action is the same, and the noun carries the difference: `comment send` sends one comment,
`review send` sends the staged review as one batch, and `comment stage` is what fills it.

Removing `comment send` entirely was considered, since `comment stage` plus `review send` does the
same in two commands. **Rejected**: filing a single comment is the most common scripted action, and
making the common case cost two commands to save one verb is a bad trade.

**`file vouch` → `file review`.** I had previously argued for keeping `vouch` because the CLI should
match what the terminal says. Then I read what the terminal says: "Mark reviewed", and "3/7
reviewed". Nothing on screen has ever said vouch. The argument was right and the fact was wrong, so
the command and its payload now say `reviewed`.

The domain keeps `vouch` internally, and that is deliberate rather than laziness. A vouch is not
"reviewed", it is a mark that lapses on its own when the file changes underneath it. That is a more
specific idea than the surface needs to expose, and it deserves its own word where the expiry logic
lives.

**`--asks` → `--question`.** A flag named for a verb fragment, on an answer that is a question.

## What was removed

**`comment drop`.** It withdrew a staged comment; `comment remove` withdrew a delivered one. Two
verbs for one intent, split by a distinction the caller does not care about: whether adiff keeps a
record. `comment remove` now handles both and reports which case it was in `staged`.

Nothing else. Every other verb has a caller, and the pairs that look redundant are not.

## What was kept, and why

**`review open` and `review pane` stay separate.** The obvious consolidation is `review open
--pane`. Rejected, and this is the one I feel strongest about: `review open` hands the terminal to
the reviewer and prints no JSON at all, while `review pane` answers with an envelope carrying
`opened`, `pane` and `command`. Merging them produces a single command whose output convention
depends on a flag, which is exactly the shapeshifting the prose rule above exists to prevent. Two
commands, two conventions, one of each.

**`--start` and `--end` stay two options.** `--lines 4-9` is one option for one concept and reads
better, but it needs parsing and a new error for a malformed range, and both callers generate these
numbers mechanically rather than typing them. Two unambiguous integers beat one string that can be
wrong.

**`comment edit` stays staged-only.** Rewording a comment the agent has already read would rewrite
history the other side has acted on.

**`file review` stays a toggle** rather than becoming idempotent with an `--off` flag. The terminal
toggles it on one key, the answer reports the resulting state, and a caller is therefore never in
doubt about where it ended up.

## What breaks

Everything named above, for anyone who had learned the old names. That is the point, and at this
size it costs one person one read of `adiff --help`. The envelope, the stdout and stderr split, the
exit codes, `--fields` and `describe` are all untouched.
