# The adiff wiki

What pages the wiki has, what each one answers, how the pages sound, and which images earn a place.
The page sources live in `wiki/` in this repository, and a workflow pushes them to
`agent-diff.wiki.git` on every merge to `main`. So a page is edited here, in a pull request, and the
wiki is the rendered copy. §7 says what that arrangement buys and what it costs `docs/`.

The pages are public, so nothing in `wiki/` names a private repository, a real branch, a ticket or a
colleague. Every capture runs on the synthetic repository `scripts/simulate.ts` builds, from an adiff
checkout.

Every fact on these pages was read out of `origin/main`, at `3ba76f8` when the pages were written and
re-checked at `2cc4f3b`, which carries the README's Homebrew wording. The read-only commands were run,
and every capture command was driven. Two facts moved under the pages while they were being written,
which is what §7's CI check is for: `adiff init` and `adiff skill refresh` no longer exist, and the
Homebrew formula installs one compiled binary that needs no Node at all.

## 1. Who reads this wiki

**A reviewer deciding whether to install adiff.** They arrived from the README. They want one screen
that says what adiff does that `git diff` does not: the comment they write is filed against the
branch with the code it sits on, the agent that wrote that code collects it and answers it, and the
thread stays open until they settle it. They need to learn early that adiff is a terminal for
reviewing the work a coding agent left in a branch, and that the agent has to be one that can run
commands in the repository.

**A reviewer reading their first diff.** adiff is installed and a branch is waiting. They want the
keys that carry them through one branch, in the order they need them: open a branch, move down the
diff, select lines, write a comment, send it, mark a file reviewed, read the answer, settle the
thread.

**An operator wiring an agent into adiff, or the agent itself.** They want the three commands that
are the loop, `comment take`, `comment answer` and `review pane`, the shape of the JSON, and the rule
that a comment comes back on every take until it is answered, settled or removed. `adiff describe`
prints the rest.

## 2. The page list

Thirteen pages, one per feature. The wiki lists them itself, alphabetically and with each page's
sections under it, so there is no `_Sidebar.md` to keep in step. Reading order lives where a reader
meets it: Home ends on Read next, and each page names the one after it.

```
Home
Install
Your first review
Branches
The diff
Comments
Threads
Reviewed files
Layers
Remarks
Preferences
Commands
When something goes wrong
```

A title is short because every link to it pays for the length, and because a reader scans a list of
thirteen rather than reads it. Home, Install and Your first review are the way in; the nine after them
are one feature each; Commands is the contract under all of them.

| Page | Answers | Sections | Length |
| --- | --- | --- | --- |
| **Home** | What is adiff, who is it for, what does it do that `git diff` does not | What adiff is, What changes when an agent wrote the code, Install, Read next | 53 lines |
| **Install** | How do I get it, and what does it need | Homebrew, npm, bun, From source, Node versions, The agent skill and which agent it is for, Where the skill lives, and why `-g`, Upgrade, The environment variables, and where the store lives | 116 lines |
| **Your first review** | A branch is waiting, walk me through it | Before you start, Open the review, Read the diff, Comment on lines, Send the comment, Mark a file reviewed, Tell the agent, Read the answer, Settle the thread, When the code moves under a comment | 145 lines |
| **Branches** | Which branch do I open, and why is mine missing | What the list shows, Why a branch is missing, An empty list, The pull request line, The keys | 62 lines |
| **The diff** | How do I move through the code | Move through it, Read more or less of it, The panes, What the header carries, Search this branch, The mouse, The footer, `?` lists every key | 74 lines |
| **Comments** | How do I say something about these lines | Select the lines, Write it, Send it, What a comment carries, Hold several and send them together, Remove one, What reaches the agent | 65 lines |
| **Threads** | The agent answered, now what | The panel and the sections it groups by, Move between them, Write back, A thread waiting on you, Settle it, When the code moves under a comment | 55 lines |
| **Reviewed files** | How do I tick a file off | Mark one, Hide what you have read, The mark lapses when the file changes, From the command line | 39 lines |
| **Layers** | What are layers, and when are they worth asking for | What a layer is, `L` asks the agent for one, The layers rail, Coverage, A layer set pinned to an older commit | 89 lines |
| **Remarks** | The pull request already has a review on it, can adiff use it | What a remark is, You ask for them first, Where remarks sit in the review panel, A remark whose code is not on screen, `A` takes one on as your own comment, `X` dismisses one, `R` writes back in its thread on the pull request, Why a remark only lands where its code is, The five commands | 100 lines |
| **Preferences** | What can I change, and what does adiff remember | The eight, From the command line, What carries between sessions | 52 lines |
| **Commands** | What is the command contract, and what does an agent run | One JSON line and the one command that answers in none, Address a branch, Failures and exit codes, `--fields`, `adiff describe`, From the command line, The loop an agent runs, `--wait` and the take rule, `review pane`, Where the skill has to live, Drafts on a pull request | 170 lines |
| **When something goes wrong** | The terminal will not draw, or the list is empty | The terminal will not draw, An empty branch list, No pull request on the list, A branch diffed against the wrong ref, `UnknownBranch`, A dead `adiff:begin` block, A report, and the switch between a full one and a minimal one | 83 lines |

Two naming decisions worth keeping:

- **Reviewed files**, not Progress. The page's own words are "marked reviewed" and the footer hint on
  `f` reads "hide read", so a reader looking for how to tick a file off scans for "reviewed". Progress
  names no subject, and `adiff review progress` is a command that reports a count rather than the
  feature.
- **When something goes wrong** stays, though it is the longest title. Troubleshooting is a gerund.
  Problems and Faults read as a list of known defects, and the page is what to do about one.

### Titles and the slugs they produce

GitHub builds a wiki page's URL from its title by turning each space into a dash and keeping the
punctuation. An internal link uses that slug exactly, or the reader lands on a create-this-page
screen. Every link is checked against this table, and a fourteenth page adds a row before it adds a
link.

| Page title | Link target |
| --- | --- |
| Home | `Home` |
| Install | `Install` |
| Your first review | `Your-first-review` |
| Branches | `Branches` |
| The diff | `The-diff` |
| Comments | `Comments` |
| Threads | `Threads` |
| Reviewed files | `Reviewed-files` |
| Layers | `Layers` |
| Remarks | `Remarks` |
| Preferences | `Preferences` |
| Commands | `Commands` |
| When something goes wrong | `When-something-goes-wrong` |

No title carries punctuation any more, so no slug does either. The page that kept an apostrophe, the
agent's side of the review, folded into Commands and Threads: the loop, the JSON a take answers with,
`--wait`, the take rule, `review pane` and where the skill has to live went to Commands, because that
is the page an operator wiring an agent in already reads; the reader-facing half, an answer that asks
a question back, went to Threads. A thin page naming one audience was worse than either.

The wiki lists its own pages, so there is no `_Sidebar.md` to keep in step.

Traps, and why each of them is not a page:

- **A generated command reference.** `adiff describe` prints every command with its options from the
  same catalog the commands run on, and `adiff <command> --help` prints one. A hand-copied table is
  wrong within a release. The Commands page teaches the contract and names those two.
- **An architecture page.** `ARCHITECTURE.md` is versioned beside the code it describes, and a user
  never needs it.
- **A "why adiff works this way" page.** The first draft of this plan had one, and every line of it
  was already in the README or in an ADR.
- **A staleness page.** Threads owns a comment whose code moved, and Layers owns a reading order
  pinned to an older commit. Each sits on the feature it belongs to.
- **A roadmap.** The PRDs carry status.
- **An FAQ.** Every question worth answering belongs on the page that owns the subject.

## 3. Home

`wiki/Home.md`. It answers what adiff is, who it is for, and what it does that `git diff` does not,
then hands the reader on. The install block is the README's two commands and the `-g` reason, so a
change to either has to move both.

## 4. Your first review

`wiki/Your-first-review.md`. One branch, from the first key to a settled thread, in the order a
reviewer needs the keys: open a branch, move down the diff, select lines, write a comment, send it,
mark a file reviewed, read the answer, settle the thread.

Both pages are in `wiki/` rather than quoted here, because §7 is what forbids a second copy of a fact
in this repository, and a page quoted into a plan is exactly that.

## 5. The flavor guide

The house rules in `CLAUDE.md` hold here, with one addition: a wiki page is read by somebody who has
not read the page before it, so every page and every section names its subject in its first sentence.

**The verb rule, stated as the defect.** A pane, the footer included, may show, list, mark, count or
read. A command may print, name or exit. `adiff` itself takes none of them, and neither does an answer,
a comment or a mark: adiff does not show a diff, and an answer does not read anything. A key doing what
the reviewer does is fine, so "`ctrl+s` sends it" and "`m` marks the file you are on as reviewed" are
both how this repo writes.

Give the reason in the plain case. No aphorism, no gerund heading, no pronoun heading, no em dash.

### Four rewrites, from sentences in this repository

**PRD 006.** "A layers is an accelerator, never a requirement."

> A layers is a reading order the agent wrote over its own diff. The layers rail opens in place of the
> file list wherever the agent published one.

The original defines layers by what they are not. The rewrite says what they are and where the reader
meets them.

**PRD 001.** "Branches with nothing to review do not appear — an empty list means there is genuinely
nothing waiting, which is a useful answer rather than a failure."

> The branch list leaves out a branch with nothing to review, so an empty list means nothing is
> waiting.

The pane does the leaving out, so the pane is the subject. "Genuinely", "useful answer" and "rather
than a failure" are the writer reassuring themselves.

**The agent skill.** "Answer the comment by doing the work, not by replying. The reviewer is watching
the diff; your next commit is the reply."

> Make the change the reviewer wants. Write an answer when you did something else, when you found a
> second problem, or when you think the comment is wrong.

The original says what not to do, then reaches for a metaphor. The rewrite names the three cases that
call for an answer.

**CONTEXT, on a vouch.** "When the agent rewrites the file the blob changes and the vouch lapses on
its own — nothing has to notice or invalidate it."

> A file you marked reviewed comes back into the file list when the agent changes it.

The reader wants the thing they will see. Blobs and what lapses on its own are for whoever implements
it.

### The words the glossary owns

The glossary owns these, and no page invents a synonym for any of them: reviewer, agent, operator,
branch, comment, review, thread, settle, anchor, side, vouched, blob, gap, hunk, patch, row, inbox,
store, take, layers, coverage, remark. `CONTEXT.md` gained the Remark entry when remarks shipped, and
it sits before Review, so a page uses the word as that entry defines it and nowhere else.

A page prints the shorter set: reviewer, agent, branch, comment, review, thread, settle, side, layers,
coverage. **Vouched** and **blob** stay in the glossary and the PRDs; on a page, a file is **marked
reviewed** and a blob is not mentioned at all.

**Layers is one document.** PRD 006 writes "a layers describes code that has changed", and
`CONTEXT.md`'s Layers entry writes "the layers describes code that has since changed", so a page says
the layers describes, shows and covers, in the singular.

One name per thing across the whole wiki:

- **file list** for the pane on the left. That is what `t` and `z` call it in the key sheet ("Show or
  hide the file list", "Hide the file list and the review panel") and what the preference calls it
  ("The file list shows only what you have not read yet."), and the changelog runs 16 to 11 the same
  way. The terminal is not uniform: the footer's `s` hint reads "file tree" when the rail is showing
  layers, so Layers quotes it there and says the two names are the same pane. PRD 006 also
  writes "file tree", so a quotation from it keeps the word. "Sidebar" is for the wiki's own
  navigation, never for the pane.
- **layers** for what the agent publishes over a diff, and **the layers rail** for the pane that
  lists them.
- **the review panel** for the pane on the right, and **`review pane`** only for the command that
  splits a multiplexer. A page that uses both in one paragraph says "the panel" and "the `review
  pane` command".
- **GitHub**, not "the forge", which is a module name. Quoting a string the screen actually prints,
  such as "could not reach the forge", is fine as a quote.

**Review** in the glossary is the set of comments handed over together, so no page says "a review is
finished" or "what the review remembers". Say "you are done with a branch", and "what carries between
sessions".

### Never use

- **A pane verb or a command verb on any other subject.** The rule is above; this is the habit this
  repo actually has.
- **worktree**, in anything a reviewer reads. Say the branch, or the branch you are standing in.
  `--worktree` stays a flag name on the Commands and agent pages, with no gloss on the walkthrough.
  "Checkout" is allowed where the noun is needed, since PRD 001 writes "the checkout they are standing
  in", but the phrase to reach for first is "the branch you are standing in".
- **Invented synonyms on a page.** "point" for thread, "close" for settle, "raise" for writing a
  comment. `CONTEXT.md` defines settle as "the reviewer's act of closing a thread, because the point
  was addressed and needs nothing more", and that is the right prose for a definition; on a page, the
  reviewer settles a thread.
  Layers are layers: not chapter, lane, story, tour or tray. "Narrative" and "walkthrough" are banned
  only as names for layers; PRD 006's own filename is `006-narrative-review.md`, and a page that walks
  a reader through one branch is a walkthrough.
- **Definition by contrast, and pink elephants.** Not "an accelerator, never a requirement", not
  "rather than a failure", not "this is not a diff viewer". The reader never saw the thing being
  denied.
- **Gerund headings, page titles, image labels and recording labels.**
- **Aphorisms and flourishes.** "Settling is yours alone", "so nothing is lost to a crash", "so a
  ten-file branch is one pass", "the diff keeps the room", "a page exists when a reviewer can press
  something". Each says less than the plain sentence beside it.
- **Invented numbers.** No "in ninety seconds", no "most readers".
- **Internals the reader cannot act on.** Not "because it draws through a native renderer", not
  "because the blob changes".
- "It's worth noting", "As you can see", "In order to", "simply", "just", "the lot".
- An em dash anywhere.

## 6. The screenshot plan

How capture works here, read out of `origin/main`'s `scripts/shot.ts`, `scripts/record.ts` and
`scripts/scenario.ts`:

- `pnpm shot` boots `scripts/simulate.ts` in a temporary directory and waits for the branch list, so
  every image is of the synthetic repository: invented invitation code, invented branch names, and
  seeded comments, answers and drafts of its own. No real code reaches the screen on any capture path,
  `--against` included.
- **Every capture uploads, to whatever `gh repo view` names in the directory you run it from, and
  nothing checks which repository that is.** Run captures from an adiff checkout and nowhere else. The
  upload happens before a human sees the frame, and an attachment cannot be deleted afterwards.
  **`--local` writes the frame and uploads nothing**, which is the flag to take a capture with while you
  are still deciding whether it shows the behaviour. Run it again without `--local` once the frame is
  right, and only then does it upload. `--keep` leaves a local copy and does not hold the upload back,
  so `--keep` alone is not a dry run. Either way the file lands at `shots/<slug>-after.png`, the slug
  being the label lowercased with each run of non-alphanumerics turned into a dash, so
  `--label "the branch list"` leaves `shots/the-branch-list-after.png`.
- **`--against` is for a pull request, not for the wiki.** It captures a second frame at the merge base
  and uploads that too, so a wiki image taken with it doubles the attachments for no gain.
- **Give every key its own `--keys` flag.** A `--keys` value is split on spaces only when it does not
  start with `text:`, so `--keys "text:jjj enter"` is one token and types the letters of "enter". One
  token per flag is always right, and the flags run in order.
- `termctrl send` accepts `text:<value>`, `ctrl-a` through `ctrl-z`, `enter`, `escape`, `tab`,
  `shift-tab`, the four arrows, `backspace`, `delete`, `home`, `end`, `page-up` and `page-down`. **A
  letter or a punctuation mark is not a key name**: write `text:j`, `text:?`, `text:,`, `text:/`.
  Repeats fold into one token, so `text:jjj` moves three rows. There is no shift-arrow, so
  `shift+down` cannot be sent and a growing selection cannot be captured; `text:V` selects the whole
  change instead.
- **A token typed into a box needs a wait after the key that opens it.** A box takes focus a beat after
  it is drawn, so the first characters land before it is listening. The search box loses them every
  time: six of six runs of `--keys "text:/" --keys "text:invite"` read `vite · 0 places`, and
  `--keys "wait:1000"` between the two read `invite · 9 places`. The compose box loses them under load:
  two of the first three cold runs read `ne error shape would do here`, and fourteen of fourteen were
  clean once warm. A key the screen itself handles does not need one, whatever it changed: `text:?` and
  `text:,` straight after `enter` drew their sheet on sixteen runs out of sixteen. Images 6 and 7 keep
  a wait as belt and braces, not because the rule reaches them. `until:<text>` also paces a sequence,
  by blocking until the screen shows the text.
- **The review panel is drawn at 130 columns or wider.** `panelFits` is one column short at 129, so 130
  is the number every page prints, with no "about" in front of it. Captures that must show a thread
  pass `--cols 150 --rows 34`, which is also the size the traced tests use. The default is 120 by 32,
  where the panel is absent.
- **The rows are alphabetical**, and the seeded state is fixed. Verified with three identical
  `pnpm simulate --probe` runs: row 1 `add-teammate-invitations` (2 layers, one comment still waiting
  on the agent, two drafts on a pull request), row 2 `drop-the-legacy-invite-client`, row 3
  `move-invites-to-the-mailer`, row 4 `resend-expired-invites` (no layers, two answered threads), row 5
  `rewrite-the-invite-scheduler`, row 6 `show-invites-in-settings` (2 layers, one answered thread,
  reported stale), row 7 `tidy-the-invitations-api`. Keys below count down from row 1, so row 4 is
  `text:jjj` and row 6 is `text:jjjjj`.
- **Which branch for which frame.** An answered thread comes from row 4, which has two of them and no
  layers, so the frame carries the file list, the diff and the panel with no layers rail to explain.
  Row 6 has an answered thread as well, behind a layers rail. A comment still waiting on the agent
  comes from row 1, and only from row 1. `unanswered` in the probe counts comments still owed an
  answer, so a `0` on rows 4 and 6 is the answered state, not a seeding failure.
- **The probe's "2 held" are not held comments.** `scripts/simulate.ts` computes that number from
  `draft list`, so those two are drafts on a pull request, and no key in the terminal reaches a draft.
  Driven at 150 by 34, row 1 draws no held section and no footer count, so the footer's count of
  comments waiting to go cannot be captured at all until the simulation holds a comment of the
  reviewer's own.
- **Traces.** Any test that presses keys through the screen driver writes a trace when `ADIFF_TRACE` is
  set. `pnpm record --test <path>` films every case in a file whose trace replays, with a title card
  naming the case, and skips a case whose trace says a replay cannot do what it did. `pnpm shot
  --trace <file> --test-name "<full name>"` replays one trace as a still; it takes the last entry with
  that name and refuses a trace a capture cannot replay. Print the trace path you generated rather
  than assuming one: BSD `mktemp` substitutes only trailing X's, so `mktemp /tmp/x-XXXX.jsonl` creates
  that literal name.
- Both need `termctrl` and the `gh image` extension installed.

### Images

| # | Page | What the reader learns | Command |
| --- | --- | --- | --- |
| 1 | Home | The branch list shows every checked-out branch with changes, its files, its lines added and removed, and which branches have layers | `pnpm shot --local --label "the branch list"` |
| 2 | Home, Threads, and the walkthrough's "Read the answer" | A thread inline in the diff, the comment and then the agent's answer under the code it was written on, with the review panel beside it listing every thread grouped by state | `pnpm shot --local --cols 150 --rows 34 --keys "text:jjj" --keys "enter" --label "a thread with an answer"` (row 4, `resend-expired-invites`, carries two answered threads and no layers) |
| 3 | Your first review, The diff | A branch without layers opens on the file list and the diff | `pnpm shot --local --keys "text:jjj" --keys "enter" --label "a branch open"` |
| 4 | Your first review, Comments | A selection is a range of diff lines, drawn where the comment will land | `pnpm shot --local --keys "text:jjj" --keys "enter" --keys "text:jjj" --keys "text:V" --label "a change selected"` |
| 5 | Your first review, Comments | The compose box holds the comment until `ctrl+s`, with the selected code still in view | `pnpm shot --local --keys "text:jjj" --keys "enter" --keys "text:jjj" --keys "text:V" --keys "text:c" --keys "wait:1000" --keys "text:One error shape would do here" --label "the compose box"` |
| 6 | The diff | `?` opens a sheet of every key for the screen you are on, and filters as you type | `pnpm shot --local --keys "enter" --keys "wait:1000" --keys "text:?" --label "the key sheet"` |
| 7 | Preferences | The preferences, each with the sentence saying what it does | `pnpm shot --local --keys "enter" --keys "wait:1000" --keys "text:," --label "the preferences"` (`,` from the branch list opens the sheet over an empty review screen, so open a branch first) |
| 8 | Layers | The layers rail lists the layers, numbered, in place of the file list | `pnpm shot --local --keys "enter" --label "the layers rail"` (row 1 has layers, and a branch with layers opens on the rail) |
| 9 | Layers | A folded layer gives its read count in place of its files | `pnpm shot --local --keys "enter" --keys "text:jh" --label "a folded layer"` (the layers of the first branch opened in a session start open, so `text:h` is what shows a folded one; `text:l` there changes nothing. Layer 1 of row 1 holds one file and its row reads "0 of 1 file read", so the caption stays out of the singular and the plural, or the keys move to a layer with more than one file) |
| 10 | Layers | The rail says when the layers describes an older commit | `pnpm shot --local --keys "text:jjjjj" --keys "enter" --label "layers from an older commit"` (row 6, `show-invites-in-settings`, is reported stale) |
| 11 | Your first review, The diff | The search names how many places the term appears in, with the matches grouped under the file each sits in | `pnpm shot --local --keys "text:jjj" --keys "enter" --keys "text:/" --keys "wait:1000" --keys "text:invite" --label "a search over the branch"` (without the wait the term loses its first characters and the frame reads `0 places`) |
| 12 | Your first review, Threads | The panel, headed `Not picked up  2`, lists `src/api.ts · not in the diff` for the comment whose line the agent rewrote and `src/api.ts:3` for the one still anchored, on branch `add-a-third-line` | Two steps, because a mid-review change cannot be pressed. `TRACE=/tmp/adiff-trace-$(date +%s).jsonl; echo "$TRACE"; ADIFF_TRACE=$TRACE NODE_OPTIONS=--experimental-ffi npx vitest run src/testing/a-comment-follows-its-code.test.ts`, then `pnpm shot --local --trace $TRACE --test-name "when the agent rewrites the line a comment was written against > then the review panel says the comment is not in the diff"` |
| 13 | Remarks | A remark inline in the diff under the code it is about, with the handle that left it, and the review panel listing it under `Remarks`. The footer offers `p pull request` and no accept key, because the cursor is a line above the remark | Two steps, the same as image 12, because the simulation seeds no remarks. `TRACE=/tmp/adiff-trace-$(date +%s).jsonl; echo "$TRACE"; ADIFF_TRACE=$TRACE NODE_OPTIONS=--experimental-ffi npx vitest run src/testing/remarks-in-the-review.test.ts`, then `pnpm shot --local --trace $TRACE --test-name "when the pull request has a remark on a line of the diff > then the review panel lists it under Remarks"`. That file writes 12 traces and 10 of them replay; the two that skip are "then A accepts the remark and X removes the comment", which sends a comment from the command line, and "then an accepted remark waits with the rest", which sets a preference from the command line |

### Recordings

| # | Page | What the reader learns | Command |
| --- | --- | --- | --- |
| R1 | Your first review | Four cases, filmed from one file: a comment sits under the code it was written against after the agent adds lines above and between two commented lines; a comment follows its line into a new wording; no comment is drawn against a line that replaced a commented one; and the review panel says that comment is not in the diff | `pnpm record --test src/testing/a-comment-follows-its-code.test.ts` |
| R2 | Remarks | A remark on a line of the diff with the handle that left it, the `Remarks` section listing it, `A` handing it to the agent, and `X` moving it to `Dismissed` | `pnpm record --test src/testing/remarks-in-the-review.test.ts`. The traced world carries the remarks and `scripts/scenario.ts` builds a fake `gh` from it, so these replay. The one case that cannot is in `a-remark-the-forge-reports-oddly.test.ts`, whose arrange is marked as a forge that answers oddly |
| R3 | Your first review, under "Read the answer" | A reply the reviewer writes on two lines keeps both rows in the thread | `pnpm record --test src/testing/a-thread-keeps-its-lines.test.ts` (the file's other case, the one with an agent answer, seeds a thread into the store, which a replay cannot do, so it is skipped) |
| R4 | Remarks | One behaviour, not the file: `A` hands a remark to the agent and the remark leaves the `Remarks` section | `pnpm record` takes `--test <path>` and no case name, so it would film all ten replayable cases of that file. Film the one case off the trace instead: generate a trace as for image 13, then `pnpm shot --local --trace $TRACE --test-name "when a remark is accepted from the diff > then the agent is handed it and the remark leaves the Remarks section" --video`, which is the same call `record` makes per case |

Any other test that drives the screen can be filmed the same way, so a page that needs a frame nobody
has yet can usually get one: run the file with a fresh `ADIFF_TRACE` and film it.

### What no command can produce yet

- **An agent answering, live.** The driver marks a trace unreplayable when a comment or an answer is
  sent from the command line, or when a thread is seeded into the store. The agent page therefore
  carries code blocks and image 2, which shows an answer that already exists, and no recording.
- **The split from `adiff review pane`.** The harness drives one terminal session, so it cannot show a
  pane opening beside a conversation.
- **A remark in the diff or in the review panel, from `pnpm shot --keys` against the simulation.** The
  simulation seeds comments, answers and drafts and no remarks, so no keys sequence against it reaches
  one: the branch list reads "could not reach the forge, so no pull request is shown", and the only
  remarks anywhere in a driven frame are the two rows for `A` and `R` in the key sheet. The trace route
  does reach one:
  `Tracer.sawForge` records the seeded remarks into the trace's world and `scripts/scenario.ts` puts a
  fake `gh` built from that world on the PATH, which is how the remarks tests film. So every frame on
  the remarks page comes off a trace, the recording with `pnpm record --test` and a single still with
  `pnpm shot --trace <file> --test-name "<full name>"`.

## 7. Where each fact lives

The repository owns every fact on these pages, and the wiki shows them. `wiki/` holds the page
sources, and a workflow pushes them to `agent-diff.wiki.git` on every merge to `main`. Four things
follow from that, and they are the reason the sources live here rather than in the wiki's own
repository:

- **A page change is reviewed like code.** It arrives as a pull request, against the branch that
  changed the behaviour. A wiki edit made in the browser is reviewed by nobody.
- **CI can check the pages against the code.** A check that every command a page prints still exists
  in `src/cli/catalog.ts` would have caught `adiff init` and `adiff skill refresh` disappearing under
  these pages, which is exactly what happened while they were being written.
- **The pages sit beside the code that invalidates them.** A change that removes a command touches the
  page in the same pull request, so re-verifying a page is a smaller job than re-verifying a wiki.
- **Nobody edits a page out from under the repository.** A merge to `main` overwrites the wiki, so a
  browser edit lasts until the next merge and no longer.

### What happens to `docs/`

Their content moves into `wiki/`, and each file becomes a short pointer into it. Two copies of one
fact in one repository is the contradiction this arrangement exists to prevent, so neither file keeps
prose a page now carries. Both paths stay alive, because a released package's README links them.

This is the step after the first publish, not part of it. The change that adds these pages cuts
nothing from `docs/`, because a file emptied before the wiki renders leaves a reader with neither
copy. Cut them once a merge has pushed the pages and the wiki reads them back.

- **`docs/install.md` → `wiki/Install.md`.** That page carries the bun route, `adiff upgrade`
  with `--check`, the `~/.adiff/upgrade.json` cache and what the file says about itself,
  `ADIFF_NO_UPGRADE_CHECK`, which turns the check and the hint off, `ADIFF_REGISTRY`, which points the
  check at a different endpoint, `ADIFF_UPGRADE_ROUTE`, which names the install adiff should believe it
  has, one of `brew`, `npm`, `bun`, `binary` or `source`, and `ADIFF_ROOT`, which moves the store off
  `~/.adiff`. Absorbing all of it is why that page is one of the longest. `docs/install.md` keeps
  the Homebrew command and one line pointing at `wiki/Install.md`.
- **`docs/handover.md` → two pages.** The loop, the `--wait` contract, what `review pane` answers,
  `comment send` and `comment list` all sit in `wiki/Commands.md`; the reading order, the layers
  document and the coverage fields sit in `wiki/Layers.md`. `docs/handover.md` keeps a pointer to both
  and to `skills/adiff/SKILL.md`, which ships in the package and is what an agent actually reads.
- **`README.md` → `wiki/Home.md`.** The install lines and the screenshot stay, with a link to the wiki
  above the section links the README already carries.

Five facts would otherwise have no page at all. Each is placed here rather than left to fall out, and
each keeps its home under the arrangement above:

- **`comment send` and `comment list`.** `skills/adiff/SKILL.md` names `comment send` once in passing,
  to say `draft add` anchors the same way, and never covers `comment list`, so the Commands page gains a
  "From the command line" section for both, including what `comment list` answers with: `state`, `stale`
  and `answers` per comment.
- **The upgrade hint.** Install says the footer mentions a new version once and never again for
  that version, that it reads the `~/.adiff/upgrade.json` cache refreshed in the background at most
  once a day so the network is never on a command's path, and that it never reaches a JSON envelope or
  stderr, because an agent parsing adiff's output should not find a new key or a line that reads like
  an instruction. That last part is a guarantee to agents and is worth keeping in those terms.
- **`npx skills update adiff`**, which `adiff upgrade` prints so the skill comes up with the binary.
  Install carries it beside `adiff upgrade`, along with `--run`, which is still accepted and does
  nothing, because it named what now happens by default. `run` sits in the catalog's globally known
  options rather than in `upgrade`'s own list, and nothing reads it.
- **`ADIFF_ROOT`.** The store sits at `~/.adiff` and `ADIFF_ROOT` moves it. Install says so
  wherever it names the store, and leaves `ADIFF_SESSION`, `ADIFF_FONT` and `ADIFF_MARKS` out as test hooks.
- **`pnpm simulate`.** Install's "From source" section says it is the quickest way to see adiff
  without a review of your own. Those facts come from `docs/handover.md`, not `docs/install.md`, whose
  own line says only that it opens a throwaway repository: `corepack disable pnpm` before the pnpm 12
  install, because corepack cannot install a beta; seven branches, from a three-file error type up to a
  42-file migration; real repositories and `~/.adiff` untouched, with the workspace gone when you quit;
  and `pnpm simulate --probe` for the round trip headless.

Left out of these pages on purpose:

- **The module map, the Effect conventions and the lint rules.** `ARCHITECTURE.md` and
  `.agents/EFFECT.md` own them and are reviewed with the code they describe. A user never needs them,
  and a contributor is already in the repository.
- **The PRDs and the ADRs.** They are contracts and decisions with dates and statuses, and a second
  copy would need reviewing twice.
- **The full command catalog.** `adiff describe` prints it from the same catalog the commands run on.
- **How to make a change to adiff.** `.agents/OPERATING.md`, `CLAUDE.md` and the release-notes skill
  are for whoever is writing adiff, and they already sit beside the code they govern. A reader who
  wants them is in the repository.
- **Drafts as a page.** The five `draft` commands, `draft list`, `add`, `edit`, `drop` and `send`, are
  released, so they get a section on the Commands page. That section says plainly that only the
  reviewer runs `draft send`, and that it posts the held comments to GitHub as one review under the
  reviewer's name: a page an agent reads must not look like permission to publish a review in somebody
  else's name. The reviewer-facing page waits until a key in the terminal reaches a draft, and PRD 012
  is a draft.

## 8. The remarks page, in detail

The pull request's own review shipped in 0.1.0-alpha.148, so this is a page rather than a plan. Every
fact below was read on `12daea2`.

**What a remark is.** `CONTEXT.md` owns the word: an anchored remark on the branch's pull request, read
from GitHub rather than written in adiff, carrying the handle that left it, which may be the reviewer's
own, and every reply in its thread. The reviewer triages it, and it reaches the agent only as a comment
the reviewer accepted. On a page that is one line: a remark is context, a comment is work.

**The captures come off a trace.** The simulation seeds no remarks, so no keys sequence against it
reaches one. `Tracer.sawForge` records the seeded remarks into the trace's world and `scripts/scenario.ts`
builds a fake `gh` from it, so this file's cases replay: image 13 is the still, and R4 films `A`.

**Where remarks sit.** The review panel gains two sections, `Remarks` and `Dismissed`. Both need the
width every other panel section needs, 130 columns; below that a remark shows inline in the diff
and nowhere else.

**A remark whose code is not on screen.** Three states, and they mean different things, so quote them
as they read: ` · outdated` when GitHub says the thread is outdated, ` · outside this diff` when the
file is in the diff but that code is not shown, and ` · not in the diff` when the file is not in the
diff at all. A remark cut short in the diff ends with "more lines, press p to read it on the pull
request", and `p` is the key that opens the pull request in a browser.

**`A` takes a remark on as your own comment**, which is what puts it in front of the agent.
`adiff remark accept --body "…"` accepts it in different words, for a remark whose point is right and
whose wording is not.

**`X` dismisses the remark the cursor is on**, and it moves to `Dismissed` rather than off the pull
request. A second press restores it. The footer reads `dismiss` in place of `remove` while the cursor
is on a remark, and `restore` on a dismissed one.

**`R` writes back in the remark's thread on the pull request**, as a threaded reply. When GitHub does
not confirm the reply with an id, adiff reports it refused: the notice reads "the forge would not take
that reply", and the page says plainly that the words did not leave the machine. `R` on a thread of the
reviewer's own is unchanged, and *answer* stays the agent's word.

**Why a remark only lands where its code is.** A comment of the reviewer's own re-anchors through
`foundAgain`, which will settle on a line close enough to the one it was written against, within a
quarter of the line in edits. A remark goes through `foundExactly` and lands only where its code is
still exactly what it was, because a stranger's remark drawn against code it was never about is the
failure the feature exists to prevent. Readers notice the difference before they are told, so the page
says it in one sentence.

**The five commands.** `remark list` gives every remark on the branch's pull request with who left it
and whether it is triaged, `remark accept` takes one on, `remark reply` answers one in its thread,
`remark dismiss` takes one out of the review and leaves it on the pull request, and `remark restore`
puts it back.

## 9. The troubleshooting page, in detail


Three things on it appear nowhere else in the wiki, and each one is easy to get wrong.

*A branch diffed against the wrong ref.* A branch stacked on another is diffed against the ref it is
stacked on, and a diff that looks too large or too small is usually diffed against the wrong one.
`adiff base set --repo . --branch <name> --base <ref>` records the ref so it is not retyped, and
`adiff base clear` goes back to the stacked parent. `--base <ref>` on `review open` and `review pane`
does the same for one session, and `review pane` carries it into the pane it opens and into the command
it reports.

*A dead `adiff:begin` block, and a skill an agent cannot see.* A repository whose `AGENTS.md` or
`CLAUDE.md` holds a block between `<!-- adiff:begin -->` and `<!-- adiff:end -->` can delete it:
nothing reads it. adiff has no command that writes or rewrites a skill, so both cases go back to
`npx skills add Newbie012/agent-diff --skill adiff -g`: run it again to refresh the skill, and run it
with `-g` when an agent working in a worktree cannot see a skill that was written into the repository
and never committed.

*A report, and the switch between a full one and a minimal one.* `ctrl+b` opens a report, `ctrl+t`
switches the open report between full and minimal, and `ctrl+s` sends whichever is showing. The full one
is what you get if you do not press `ctrl+t`. Nothing leaves the machine: the report is written to
`~/.adiff/reports/<stamp>.md` and copied to the clipboard.

A full report carries the adiff version, the Node version, the platform, the machine's hostname, the
terminal size, the repository path, the branch, the file and row, the screen and pane, how many of the
branch's files are marked reviewed, the first line of the last internal failure, what led here, the
keys pressed, the visible file list, and the diff rows around the cursor.

A minimal one carries the words you typed, the adiff and Node versions, the platform, the terminal
size, which screen and pane you were on, how many of the branch's files you had marked reviewed, and
the kind of the last failure without its message. It names no machine, repository, branch or file, and
carries no code, no keys and no trail. The box reads "Only what you type is sent." while it is showing.
The page names which of the two to paste in public.
