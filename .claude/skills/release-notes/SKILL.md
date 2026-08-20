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

Same discipline, one level up.

- The title is the sentence you would have written as the entry, without the `kind(area):` prefix.
- The body opens with two or three sentences on what changed and why. Then, if the PR fixes several
  things, one `##` heading per thing, matching the entries in the change intent.
- Reproduction steps and the reasoning go in the body. That is what the body is for, and it is why
  the changelog does not need them.
- Never paste raw command output, a directory listing, or a shell transcript into a PR body. Check
  what you wrote actually renders before you open the PR.
- No test counts, no "full suite green", no self-assessment.

## Before you open the PR

```bash
node scripts/changelog.ts            # rewrites CHANGELOG.md from every change intent
node scripts/changelog.ts 0.1.0-alpha.133   # prints one release's note, as the release page shows it
```

`CHANGELOG.md` is regenerated by the release workflow, so it does not need to be committed with the
change intent — but run the generator and read the output. If your entry looks wrong there, it will
look wrong on the release page.
