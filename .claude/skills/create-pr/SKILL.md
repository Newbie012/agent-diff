---
name: create-pr
description: Open or update an adiff pull request — a short body, a change intent, and a recording of every test the branch adds, embedded inline via GitHub user-attachments. Use when asked to create, update or fix up a PR in this repository.
---

# Create an adiff PR

Load `release-notes` first and apply every rule in it: the change intent shape, the `kind(area):`
sentence, the no-gerund rule, and what never goes in a body. Everything here is additive.

A reviewer of an adiff PR wants two things: one line saying what changed, and a moving picture of it
working. The body carries the first. `pnpm record` carries the second.

## One command

```bash
pnpm record
```

It reads the test files this branch changed against `origin/main`, runs them with tracing on, and for
each test builds its world into a real repository, boots adiff in a real terminal, replays the keys
the test pressed, and encodes an mp4 into `shots/`. It uploads nothing. It prints a finished
`## Recorded tests` section whose films point at their local paths, and the `--attach` flags that
upload them. Paste the section under the body and pass the flags to `gh pr create` or `gh pr edit`
(see **Upload**).

`pnpm record --test <path>` records one file instead of the whole branch. `pnpm record --base
<branch>` reads the branch against something other than `origin/main`, which is what a PR stacked on
another PR needs so it records only its own tests.

A recording narrates itself, so somebody who has never opened adiff can follow it:

- each step is held for a second, with a band naming it in plain words — `open the branch`,
  `leave a comment saying "worth a second look"` — and a key cap in the corner showing the key as it
  is pressed, so the caption, the key and what happens on screen line up
- every `expect` stops the screen, rings the pane it is about, and says the claim as a sentence:
  `the review panel contains worth a second look`

The sentence names its own subject, which is why it needs no label. Assertions running one after
another with nothing in between share a beat and the band lists them; assertions separated by
something the reviewer does each get their own. `--pace <ms>` and `--hold <ms>` change the timings.

The ring comes from the view accessor the assertion read — `reviewPanel()` rings the review panel,
`focus()` rings whichever pane the keys reach. An assertion about no single region, such as which
panes are on screen, gets the sentence and no ring.

For the caption to appear, the test must take `expect` from the testing barrel rather than from
vitest directly. A test that does not still records; it just has no captions.

The recording is driven by the test's own trace, so it cannot show something the test does not do. If
a test fails, nothing is recorded — a green run is the precondition, not a claim to make in prose.

## A recording replays keys, and nothing else

The replay rebuilds the world from the trace — the branch fixture and the layers, and nothing more —
then presses the keys. The one exception is a branch checked out in the directory under review with
`driver.branch.switchTo`: the trace keeps it as a step, and the replay checks out the same branch at
the same moment. Anything else a test does by another route is not there: a file changed or
committed after the world was built, a comment or an answer seeded through the store or the command
line, a preference set from outside. A test that does any of those marks its trace unreplayable, and
`pnpm record` skips it and says which route it took.

So a test that needs one of those things has two honest endings, and no third:

- **Write it with keys instead**, if the same rule can be reached that way. A reviewer's reply
  exercises the same drawing rule an agent's answer does, and a reply is keys. That test records.
- **Let it be skipped**, and say in the PR body which behavior has no film and why.

**Never paste a recording you have not looked at.** Take the still of the same trace and read it:

```bash
pnpm shot --trace <trace.jsonl> --test-name "<when> > <then>" --local
```

`--local` writes the frame to `shots/` and prints its path. Nothing a capture makes is published
until `gh --attach` uploads it, so read every still and film before it goes on a pull request.

The still is the last frame of the film. If it does not show the behavior the test names, the film
does not either — and a film that shows the wrong screen is worse than no film, because a reviewer
believes it. `pnpm record` writes its trace to a temp directory and prints the path in its error
output; to keep one, run the tests yourself with `ADIFF_TRACE=<path>` set.

A run appends to that file rather than replacing it, so running the same test into it twice leaves
two traces under one name. The capture takes the newest, so a re-run shows the re-run. A trace the
test marked unreplayable is refused, naming the route the test took, so nothing is made from it.

## What gets recorded

Every test the branch adds, one recording each, not a representative sample. Skip only when the
branch changes nothing a reviewer could see: a refactor, a type, a script, a document.

A test that presses no keys produces no recording, which is the right answer for a pure CLI or store
test. Do not invent keystrokes to make one.

## The section it prints

```markdown
## Recorded tests

- when the review panel is opened

  <details>
  <summary><code>then the keys are already on the comments</code></summary>

  ![then the keys are already on the comments](./shots/when-the-review-panel-is-opened-then-the-keys-are-already-on-the-comments.mp4)

  </details>
```

The `describe` is the plain-text list item and the `test` is the summary of a `<details>` nested
under it, indented two spaces so it stays inside the item. Two tests under one `when` share the list
item. The summary is the test title only — no duration, no dimensions, no file size.

## Upload

gh uploads the films itself, with its own sign-in: no extension and no browser cookie. From the
repository root, so the paths in the body and in the flags match:

```bash
gh pr create --base main --title "…" --body-file body.md \
  --attach ./shots/<one>.mp4 --attach ./shots/<two>.mp4
gh pr edit <n> --body-file body.md --attach ./shots/<one>.mp4    # a PR that already exists
```

gh uploads each file and rewrites its `![…](./shots/…)` reference in place. A film becomes the bare
user-attachments URL on its own line, which GitHub wraps in a player; an image stays an image. A file
named in `--attach` that the body never references is appended to the end instead. Pass one
`--attach` per file, each its own word: zsh does not split an unquoted variable, so flags built into
one string reach gh as one bad argument.

Check the render rather than the markdown, since nesting inside a list is where the player is lost:

```bash
gh api repos/Newbie012/agent-diff/pulls/<n> -H "Accept: application/vnd.github.html+json" --jq .body_html | grep -c "<video"
```

The count must equal the number of films.

## Where it goes

After the prose and after `## What changed`, before anything else. A reviewer reads what changed,
then watches it.

## The whole template

```markdown
### What changed

<one paragraph, 200-300 characters, high level, technical>

### Recorded tests

<the pnpm record section, when the branch adds tests that press keys>
```

Two headings, in that order, and nothing else: no prose above `### What changed`, no "why", no
investigation, no test counts. A branch with no recordings carries the first heading alone.

## Check the body before it is posted

```bash
pnpm check-body body.md
```

Run it on the file you are about to pass to `gh pr create --body-file` or `gh pr edit --body-file`,
every time. It refuses a body that says who reported the change, places it with somebody at work,
carries a private repository or a ticket, or runs past 300 characters of prose. A body says what
changed and what it does now — never who asked for it.

## Nothing private, ever

This repository is public and so is every attachment. `pnpm record` is safe by construction: it
builds each world from the test's own fixture, which is invented code in an invented repository, and
it never opens a real one. Keep it that way — never point a capture at a real checkout, and never
paste a branch name, path, ticket id or line of source from private work into a body.

An attachment cannot be deleted once uploaded.

## Before it will work

```bash
cargo install --locked terminal-control     # once
gh --version                                # 2.99 or later, for --attach
```

`termctrl` lives in `~/.cargo/bin`, which is not always on the PATH of a non-interactive shell.
