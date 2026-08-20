# PRD-011 — Preferences

> The handful of choices a reviewer makes about how the review behaves, kept between sessions and
> changed from the terminal, the file, or the command line.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-21

## Problem Statement

Two people reviewing the same branch do not want the same terminal. One wants the file's heading
pinned while they scroll and the other finds it noise. One wants long lines wrapped, another wants
them cut and panned. One writes a comment and wants it gone the moment it is written; another
writes six about one file and wants to read them over before any of them lands.

adiff already keeps two of these choices and forgets the rest, and the two it keeps are invisible:
they are toggled by a key the reviewer has to already know, and nothing says what the toggle is set
to or that it survived the session. A preference nobody can find is a preference nobody has.

## Solution

Preferences are a short, named list. Each one has a plain name, a value that is on or off, and a
sentence saying what it does. The list is written to one file, applies to every repository, and
outlives the session.

Three ways to change one, because three different people are asking. A reviewer opens the
preferences from the review and toggles what they see. Somebody setting up a machine edits the file
and knows the shape will not move under them. An agent, or a script, or somebody who lives on the
command line, reads and writes one by name.

One of the preferences is whether a comment goes the moment it is written. With it off, comments
are held, the review says how many are waiting, and one key sends them together.

## User Stories

1. As a `reviewer`, I want to see what adiff is doing and change it, so that I do not have to
   remember which key toggles what.
2. As a `reviewer`, I want my choices to still be there tomorrow, so that setting them is a thing I
   do once.
3. As a `reviewer`, I want to write several comments about one file and send them together, so that
   the agent gets a considered set rather than a running commentary.
4. As a `reviewer`, I want to be told how many comments are waiting to go, so that I cannot walk
   away having written six and sent none.
5. As an `operator`, I want to write the file by hand and have it respected, so that a machine can
   be set up without opening the terminal.
6. As an `agent`, I want to read and set a preference by name, so that a repository can be handed
   over with sensible defaults.
7. As a `reviewer`, I want a preferences file I have broken to be ignored rather than fatal, so
   that a stray comma does not stop me reviewing.

## Implementation Decisions

### Owns

The named list of preferences, the file they live in, the screen that shows them, the commands that
read and write them, and holding comments back until they are sent.

### Does not own

What each preference does once it is set — that behaviour belongs to the PRD that owns it
([003](003-review-terminal.md) for the terminal, [004](004-comment-delivery.md) for delivery. The
store's location and the `ADIFF_ROOT` override belong to
[PRD 009](009-runtime-and-configuration.md).

### Public contract

- **A preference is a name, a value that is on or off, and a sentence.** No numbers, no strings, no
  nesting. Every preference can be drawn as a line with a mark against it and toggled with one key,
  and anything that cannot be is not a preference — it is a command, or an argument.

- **Preferences are global.** One file, one answer, for every repository on the machine. A review
  is a thing a person does the same way wherever they are, and a per-repository answer is a second
  place to look when the terminal does something surprising.

- **The file is the contract.** `<root>/settings.json`, an object of names to booleans, written
  whole. A name it does not know is left alone rather than dropped, so a newer adiff that wrote a
  preference an older one does not understand can still read its own file back.

- **A file that cannot be read is a file that says nothing.** Preferences fall back to their
  defaults and the review opens. Nothing about how a diff is drawn is worth refusing to draw it.

- **Every preference has a default that is what adiff did before it existed.** Turning the list on
  for the first time changes nothing about how the review behaves.

- **The screen lists every preference, its value, and what it does.** Opened with one key from the
  review, moved through with the arrows, toggled with return, closed with escape. A toggle takes
  effect where it can be seen — the diff behind the screen redraws under it — and is written when
  it is made, not when the screen closes.

- **The keys that toggle a preference keep working.** A reviewer who knows the key for wrapping
  keeps it, and pressing it changes the same preference the screen shows. Two ways to reach one
  answer, not two answers.

- **A preference is set to on or off, and anything else is refused.** `--value maybe` was read as
  "not on", so a typo turned a preference off and said it had worked. What a value is not allowed
  to do is quietly mean its opposite.

- **`adiff config list` says every preference, its value and its default.** `config get <name>` and
  `config set <name> <on|off>` read and write one. An unknown name is refused with the list of
  names, in the same shape as every other refusal.

- **Comments are held only if the reviewer asked for that.** The default is what adiff does today:
  a comment goes the moment it is written. With holding on, writing a comment puts it in a set that
  has not gone anywhere, the review says how many are waiting, and one key sends them all.

- **A held comment is not a sent comment.** It has no id an agent could answer, it is not in the
  inbox, and nothing about delivery changes when the set is sent — it is the same submission the
  reviewer would have made one at a time. Holding is a pause before the store, not a new state
  inside it.

- **Held comments do not survive the session.** Leaving with comments waiting says so and asks once.
  A half-written review that persists is a review the reviewer has forgotten they owe, and the
  store is for what has been said, not for what was nearly said.

- **A held comment can be dropped before it is sent.** Holding exists so a point can be reconsidered,
  and a set that can only grow is not a pause, it is a queue.
