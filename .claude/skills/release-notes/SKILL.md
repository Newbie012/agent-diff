---
name: release-notes
description: Write the change intent, the PR description and the release note for a change to adiff. Use when opening a PR here, when adding or editing a file in .changeset/, when asked to fix up a PR body or a release note, or when deciding whether a change is worth a release at all.
---

# Release notes for adiff

Every release note in this repo comes from one place: a change intent file in `.changeset/`.
`scripts/changelog.ts` reads those files, groups them, and writes `CHANGELOG.md` and the text on
the GitHub release page. Nothing else is edited by hand — do not edit `CHANGELOG.md` yourself.

A reader of a release note wants two things in this order: **which part of adiff changed**, and
**what it does now**. Give them that in one sentence. Everything else goes behind a fold.

## Does this change deserve a release at all?

Only four kinds of change ship a note:

| Kind | Write it as | Lands under |
| --- | --- | --- |
| Something adiff could not do before | `feat(area): …` | `### Added` |
| Something adiff did wrong | `fix(area): …` | `### Fixed` |
| Something measurably faster or smaller | `perf(area): …` | `### Performance` |
| Something that changes what an existing command or key means | `breaking(area): …` | `### Breaking` |

**A refactor, a test, a doc, a CI change or a rename gets no change intent file.** No file, no
version bump, no note. If the change is invisible to a reviewer using adiff, it is invisible in the
changelog too. Say so in the PR body instead. A PR that touches only `src/testing/`, `.agents/`,
`.github/`, `README.md` or `ARCHITECTURE.md` almost never needs one.

If you are unsure, ask: would someone who upgraded notice? If no, no file.

## The shape of a change intent

`.changeset/<name>.md`:

```markdown
---
"@eliya-oss/agent-diff": patch
---

fix(layers rail): the cursor stays on the rail when you collapse the layer you are reading.

<details><summary>What was wrong</summary>

Collapsing took the cursor off the whole rail — nothing said where you were, and the layer read
like one you had not started.

</details>
```

which renders as:

```markdown
## 0.1.0-alpha.132

### Fixed

- **Layers rail** — the cursor stays on the rail when you collapse the layer you are reading.

  <details><summary>What was wrong</summary>
  …
  </details>
```

Rules the generator and `a-changelog-that-says-what-kind-of-change.test.ts` enforce:

- The first line of every entry is `kind(area): one sentence.` — a full stop at the end, no
  capital at the start, no line break inside it.
- `kind` is exactly one of `feat`, `fix`, `perf`, `breaking`.
- `area` is lowercase, and is capitalised for you when it is rendered. Write `CLI` and `README` in
  the case you want them.
- Anything between one entry and the next belongs to the entry above it, and is indented under its
  bullet.

## One entry per thing that changed

A PR that fixes five things writes **five entries in one file**, not one paragraph covering five.
This is the single biggest difference from how this repo used to write notes.

```markdown
fix(layers rail): the cursor stays on the rail when you collapse the layer you are reading.

<details>…</details>

fix(reading order): a first layer naming no file in the diff opens at the first file, not the last.

<details>…</details>
```

Each one gets its own bullet, under the right heading, and can be found by someone searching for
the part of adiff it names.

## Naming the area

Use the name a reviewer would use for the thing on screen. The ones already in use:

`diff` · `file tree` · `layers` · `layers rail` · `reading order` · `review panel` · `footer` ·
`marks` · `keys` · `search` · `key sheet` · `command palette` · `home screen` · `comment delivery` ·
`store` · `preferences` · `upgrade` · `CLI` · `changelog`

Reuse one before inventing another, and check `.agents/prd/CONTEXT.md` — never invent a word the
glossary already has.

## The sentence

Write what is true **now**, in the present tense, from the reviewer's side of the screen.

- `fix(diff): a binary file says it is binary instead of drawing an empty pane.`
- `feat(search): typing narrows the matches as you type.`
- `perf(review): opening a 131-file branch takes 1.5s, down from 2.85s.`

Not:

- ~~`fix(diff): fixed the binary file handling`~~ — says nothing about what a reader will see.
- ~~`fix(diff): refactored patch parsing so binary blobs short-circuit`~~ — describes the code.
- ~~`fix(diff): a binary file that adiff cannot show`~~ — a title, not a statement.

**No gerund titles.** "Saying what is not there", "Opening onto one branch", "Asking before
leaving" are all wrong. Write a statement with a verb in it: "a file with no newline says so".
This holds for the sentence, the branch name, the changeset filename, the PR title and the test
filename.

For `perf`, give both numbers and what they were measured on. A speed claim with no measurement is
not a release note.

## What goes behind the fold

The `<details>` block is for the reader who hits the bug and wants to know it is the one they hit.
Put the symptom there, in the words someone would use to describe what they saw. Keep it to a
paragraph or two.

Leave it out entirely when the sentence is the whole story — most `feat` entries need nothing.

Do not put in it: the file you changed, the function you added, the test you wrote, a count of
tests, or how long it took you. Those belong in the PR.

## The PR description

### The template

```markdown
One paragraph. What this changes, and what prompted it. Two or three sentences.

## What changed

### Fixed

- **Layers rail** — the cursor stays on the rail when you collapse the layer you are reading.
- **Reading order** — a first layer naming no file in the diff opens at the first file, not the last.

### Added

- **Search** — typing narrows the matches as you type.

## The rail lost the cursor when you folded the layer you were in

The repro, as keys to press. Then what the fix was.

<table>
<tr><th>Before</th><th>After</th></tr>
<tr>
<td><img src="https://github.com/user-attachments/assets/…" alt="before"></td>
<td><img src="https://github.com/user-attachments/assets/…" alt="after"></td>
</tr>
</table>

## Reading order opened at the end

The repro. Then what the fix was.
```

- The **title** is the entry sentence without the `kind(area):` prefix, and follows the same
  no-gerund rule.
- **`## What changed` is generated, never typed.** `node scripts/pr-summary.ts` prints it from the
  change intents on this branch. The PR and the changelog then cannot drift apart.
- **One `##` section per thing changed**, in the order the bullets list them, titled with the
  symptom rather than the fix. That is what a reader searching their own bug will match on.
- A PR with **one entry and nothing to reproduce** is a title and a sentence. The template starts
  earning its keep at two.
- A PR with **no change intent** — a refactor, a test, a doc — writes prose. `pnpm pr-summary`
  will tell you there is nothing to paste, and that is the correct answer, not a problem to fix.

### What never goes in a PR body

- **Raw command output.** No `ls` listings, no shell transcripts, no stack traces pasted whole.
  Quote the one line that matters.
- **Backticks around anything a shell would run.** Writing a body in a heredoc executes
  `` `l` `` and pastes its output into your prose. Write the body to a file, then
  `gh pr create --body-file`.
- **Test counts, timings, or self-assessment.** No "full suite green", no "740 tests", no
  "verified twice". CI says whether the tests pass.
- **Anything from a private repository.** See below.

### Nothing private, ever

This repository is public, and so is every PR body, screenshot and recording attached to it. Before
you open or edit a PR, read what you wrote and confirm none of it carries:

- an employer's or a customer's name, or a private repository's name
- a ticket id, an internal URL, a dashboard link, or an internal hostname
- a real branch name, file path, or line of source from private work
- a colleague's name or address, or any credential, token or key

A screenshot leaks all of this faster than prose does, which is why **every capture runs against the
synthetic demo repository** — `scripts/simulate.ts` builds a repo of invented invitation code with
invented branch names. Never screenshot a review of real work. If you cannot reproduce a bug on the
synthetic repo, describe it instead, or seed what you need in `scripts/simulation/seed.ts`.

An attachment cannot be deleted once uploaded. There is no public deletion API for
user-attachments, so a leak is permanent.

### Showing a screen

adiff is a terminal, so a screenshot is a real PNG of a real terminal, captured with
[terminal-control](https://github.com/anomalyco/terminal-control) and uploaded to GitHub's
attachment store.

```bash
cargo install --locked terminal-control          # once
gh extension install drogers0/gh-image           # once, then `gh image check-token`
```

**Something new** gets one image:

```bash
pnpm shot --keys "enter text:l" --label "a layer opened"
```

**Something that changed** gets a before and an after, in a one-row table so the two sit side by
side rather than a screen apart:

```bash
pnpm shot --keys "enter text:l" --label "the layers rail" --against origin/main
```

`--against` builds a worktree at the merge base, captures the same keystrokes on the code as it was,
and prints the finished `<table>` with both images uploaded. Paste it under the section it belongs
to. If the two frames come out identical the script says so and stops — those keys do not reach the
screen you changed.

**Something about motion** — scroll feel, focus moving, a gap opening ten lines at a time — gets a
recording, because a still frame cannot show it:

```bash
pnpm shot --keys "enter text:l text:l text:l" --label "the gap opening" --video
```

That prints a bare URL. Leave it bare: GitHub wraps a player around a user-attachments URL on its
own line, and `![…](…)` image markdown around a video renders nothing.

Keys are termctrl's: `enter`, `escape`, `tab`, `up`, `down`, `page-up`, `ctrl-a` through `ctrl-z`,
and `text:<value>` for anything typed, including single letters like `text:l`. Add `--keep` to leave
the files in `shots/` instead of deleting them after upload.

## Before you open the PR

```bash
node scripts/changelog.ts            # rewrites CHANGELOG.md from every change intent
node scripts/changelog.ts 0.1.0-alpha.133   # prints one release's note, as the release page shows it
node scripts/pr-summary.ts           # prints the `## What changed` block for this branch
```

`CHANGELOG.md` is regenerated by the release workflow, so it does not need to be committed with the
change intent — but run the generator and read the output. If your entry looks wrong there, it will
look wrong on the release page.
