# Changelog

## 0.1.0-alpha.137

### Added

- **Keys** — `t` shows or hides the file list on its own, leaving the review panel where it is.

  <details><summary>What was wrong</summary>

  `z` hid the file list and the review panel together, so reading a wide diff beside your comments meant hiding both and bringing one back — `z` then `a`, which works by accident of composition rather than because anything offers it.

  </details>

### Fixed

- **Diff** — a layer's prose carries a rule down its margin, so it cannot be read as the file.

  <details><summary>What was wrong</summary>

  The prose sat between two lines of code with no line number, no marker and nothing else to say it was not part of the file, so a note about the change below it read as stray markdown someone had committed.

  </details>

- **Footer** — a stale reading order says which key asks for a new one.

  <details><summary>What was wrong</summary>

  The header said `layers stale` and stopped there, and `L` was in neither footer, so the one thing to do about it was only findable by reading the key sheet. The header now names the key, and the footer offers it while the order is stale.

  </details>

### Performance

- **Diff** — turning to the next file takes about 15ms, down from about 77ms.

  <details><summary>What was wrong</summary>

  Every turn read the whole file at both ends of the diff before the screen moved, and those two reads exist only to feed syntax highlighting. The diff itself is already in memory, so the file now opens straight away and the colour follows it.

  </details>

## 0.1.0-alpha.136

### Fixed

- **Layers rail** — the wheel keeps working after a flick, and moves one file per notch.

  <details><summary>What was wrong</summary>

  The guard that stopped a trackpad flick running on past the gesture was never cleared when a move failed, so after one bad load the rail stopped answering the wheel entirely. It is cleared whatever happens now, and a notch that arrives mid-load is remembered rather than thrown away, so movement keeps up with the gesture instead of dropping out of it.

  The wheel was also registered twice over the file list — once on the pane and once on the text inside it — so a single notch moved two files.

  </details>

- **Key sheet** — `?` fills the screen and lays the keys out in two columns under their section headings.

  <details><summary>What was wrong</summary>

  Fifty keys were drawn in one narrow column the same size and shape as the command palette, so it scrolled even on a tall terminal and the category was repeated on every row instead of heading a section. The two columns fit most of the sheet at once, the headings say what each group is, and the space the repeated category took goes to the descriptions, which were being cut mid-word.

  </details>

- **Review panel** — opening the panel puts the keys on it, and closing gives them back to the pane you came from.

  <details><summary>What was wrong</summary>

  `a` opened the panel and left the keys wherever they were, so the comments you had just asked to see could not be moved through without a second press of `tab`. Closing it sent the keys to the diff whatever you had been reading before, so opening and closing the panel quietly moved you off the file list. The panel is left alone when there is nothing in it to read.

  </details>

### Performance

- **Diff** — the diff is not handed to the highlighter again when only the pane width changed.

  <details><summary>What was wrong</summary>

  Toggling the review panel reassigned the code pane's contents even though the text was identical, which starts a fresh parse and draws the file unhighlighted until it finishes.

  </details>

## 0.1.0-alpha.135

### Added

- **Changelog** — a release note groups what changed under Breaking, Added, Fixed and Performance, and names the part of adiff each entry is about.

  <details><summary>What it looked like before</summary>

  A release was a run of paragraphs. Five fixes in one pull request arrived as one story, with no way to tell a fix from a new behaviour, or to find the part of adiff a line was about without reading all of it.

  </details>

### Fixed

- **Review panel** — a thread says whether the agent has actually picked your comment up.

  <details><summary>What was wrong</summary>

  Everything unanswered was filed under "With the agent", which claimed custody adiff had no way to know about. `comment take` returned everything still owed an answer and left no trace, so a comment sent a second ago, one an agent had been working on for ten minutes, and one on a branch where no agent has ever run were the same thing on screen. Threads sit under "Not picked up" until something collects them, and "Picked up, no answer" after.

  </details>

- **Diff** — a thread head says how long ago the comment was picked up.

  <details><summary>What was wrong</summary>

  Every unanswered thread read `sent`. A comment an agent collected and then went away without answering — the case worth noticing — looked exactly like one written a second ago. It reads `picked up 40m ago` now.

  </details>

## 0.1.0-alpha.134

### Fixed

- **Layers rail** — a wheel still moves a file at a time, but stops when you do.

  <details><summary>What was wrong</summary>

  Each tick was queued as its own task behind a file load, so a trackpad flick left a backlog that carried on walking the review long after the gesture ended. A tick that arrives while a move is still loading is dropped rather than queued. The file tree keeps every tick, since moving that list loads nothing.

  </details>

- **Layers rail** — titles, directories and file names step in evenly, the way the file tree already did.

  <details><summary>What was wrong</summary>

  A directory sat one column left of the layer title above it and two right of the file names below it — three ragged edges rather than a hierarchy. A directory too wide for the rail was also hard-cut at the pane edge, because the shortener could return something longer than the room it was given.

  </details>

## 0.1.0-alpha.133

### Fixed

- **Changelog** — CHANGELOG.md reads newest first, ordering versions as numbers rather than as words.

  <details><summary>What was wrong</summary>

  alpha.9 sat between alpha.90 and alpha.89, and the newest release was nowhere near the top. The release pages were always right; only the generated file was wrong.

  </details>

## 0.1.0-alpha.132

### Fixed

- **Layers rail** — the cursor stays on the rail when you collapse the layer you are reading.

  <details><summary>What was wrong</summary>

  Collapsing took the cursor off the whole rail — nothing said where you were, and the layer read like one you had not started. A collapsed layer holding the cursor carries it on its title row now.

  </details>

- **Layers rail** — `r` picks up rewritten layers without leaving the rail cursorless and `l` dead.

  <details><summary>What was wrong</summary>

  After the agent rewrote the layers, the layer holding your file was collapsed, the rail had no cursor, and `l` did nothing at all, because both were still keyed to the layer index from before the reload. The index is recomputed from the file the cursor is on.

  </details>

- **Reading order** — a first layer naming no file in the diff opens the review at the first file, not the last.

  <details><summary>What was wrong</summary>

  One bad path from the agent was enough. Finding a place in the reading order looked for file 0 in layer 0, failed because layer 0 held no files, and fell back to the first appearance of diff-order file 0 — wherever the layers happened to put it. It lands on the first entry of the reading order now.

  </details>

- **Layers rail** — a file two layers both claim counts as two stops, so the counter follows `]`.

  <details><summary>What was wrong</summary>

  The counter de-duplicated the reading order and took the first match, so it read `file 1 of 3` at the end of the walk and `]` looked dead on the press between the two copies. The cursor bar is also limited to the layer being read, so the rail can say which copy you are on.

  </details>

- **Layers rail** — a layer whose spans name nothing in the diff says what it was pointing at, and keeps its note.

  <details><summary>What was wrong</summary>

  It drew a bare title with no files, no count and no note, while `adiff layers show` knew exactly what had happened. It says `nothing in this diff: pkg/ghost.ts` now. A note stays out of the rail everywhere else — the diff carries it there — but a layer with no file has nowhere else to put it.

  </details>

## 0.1.0-alpha.131

### Fixed

- **Diff** — a file whose content did not change says what did — `mode changed, 100644 to 100755`, or `renamed from pkg/gizmo.ts`.

  <details><summary>What was wrong</summary>

  Making a file executable, or renaming it, showed a diff pane containing a single bare line number and nothing else — no cursor, no explanation, and `j` did nothing because the pane had no rows. git reports both; adiff dropped the lines. The diff is shown underneath when there is one.

  That bare line number was a patch with no rows being given one blank display row and numbered. No patch can end up with no rows now, and a row that sits on no line of either side no longer borrows a number — which also cleans up the "no newline at end of file" marker.

  </details>

## 0.1.0-alpha.130

### Fixed

- **File tree** — the review opens with the folder holding your file already open.

  <details><summary>What was wrong</summary>

  In a repo with enough files that folders start collapsed, the folder holding the opening file was collapsed too — so nothing in the rail was marked, and the only way to see where you were was to press `l`. With forty-five files across five folders, seventeen of twenty-seven rail rows sat empty while the current file was hidden.

  </details>

## 0.1.0-alpha.129

### Fixed

- **Marks** — one glyph per idea — `▎` is the cursor everywhere, `○ ◐ ●` is one three-state ring for a thread, `✓` means nothing left to do.

  <details><summary>What was wrong</summary>

  Five marks were carrying twelve meanings. `✓` meant a reviewed file, a settled thread and a sent one — the last of which is the opposite of done. `○` meant "this line has a thread", "this thread is unread" and "this file is in the diff". `•` drew the same idea as `○` differently, `·` was a bullet and a separator at once, and `▎` was the cursor everywhere except the file tree, which used a background tint instead.

  The ring is drawn identically in the diff gutter, the review panel, the file tree badge and the layers rail: waiting on the agent, answered, waiting on you. `▾`/`▸` are disclosure only, and `·` is a separator.

  </details>

- **File tree** — the badge counts only threads still open, so it stops promising work that is already settled.

- **File tree** — the Nerd Font file and folder icons are gone, and the two columns they took go to the path.

- **Diff** — lines are no longer marked for a comment you removed.

## 0.1.0-alpha.128

### Fixed

- **Diff** — a file whose name is not plain ASCII is in the review.

  <details><summary>What was wrong</summary>

  git quotes such paths by default, adiff could not read the quoted form, and the file was dropped from the diff entirely — absent from the tree, absent from the count, unreachable by `]`, with nothing saying so. `layers set` reported it to the agent as vanished while it existed, and with layers set the same diff reported one more file than without.

  </details>

- **Layers rail** — a layer whose files you have all read still says so after `f` hides them.

  <details><summary>What was wrong</summary>

  The tick reverted and the layer looked unstarted, because the tally counted the visible files rather than the layer's own.

  </details>

- **Layers** — the leftover layer no longer claims nothing is left over while listing a file.

  <details><summary>What was wrong</summary>

  It could say "0 runs of changed lines the layers do not account for" above a file it was listing. It says what is actually left over now.

  </details>

## 0.1.0-alpha.127

### Fixed

- **Diff** — the pinned scope keeps the levels nearest the code rather than the ones furthest away.

  <details><summary>What was wrong</summary>

  Deeply nested code pinned the four scopes furthest from the code — so at twelve levels of nesting you were told the class and never the function you were reading. It pins the outermost one for orientation and the innermost ones for where you are, and marks the outermost with `⋯` when levels between were dropped.

  </details>

## 0.1.0-alpha.126

### Fixed

- **Layers** — a layer's note about a changed line sits above the change, not inside it.

  <details><summary>What was wrong</summary>

  When a line is replaced, git shows the old and the new one after the other, and the note was drawn between them — so four rows of prose split the one pairing a diff exists to show, on the first screen of the review.

  </details>

## 0.1.0-alpha.125

### Fixed

- **Footer** — a key that toggles something says which way it will go.

  <details><summary>What was wrong</summary>

  `f hide read` read the same whether files were hidden or shown — and the filter survives a restart, so you could open a review with files missing and nothing on screen saying so. It reads `f show read` while hiding now. Same for `f hide settled`, and `X` offers `restore` when the thread under the cursor has been removed.

  </details>

- **Layers** — `L` asks for a reading order about the branch, not about the line the cursor happened to be on.

  <details><summary>What was wrong</summary>

  The request landed as a comment card on an arbitrary import, so the agent was told to write a reading order in a thread about a line that had nothing to do with it. It is anchored to the start of the diff now, and says up front that it is about the branch.

  </details>

- **Layers rail** — every changed file has a place in the rail, including one with no changed lines.

  <details><summary>What was wrong</summary>

  A binary file, say, belonged to no layer and never reached the leftover layer either, so the rail listed seven of eight files, the two rails disagreed about the count, and `]` could never reach the eighth.

  </details>

- **Footer** — `→ N columns cut off` counts only columns that are cut, and names the key that pans.

## 0.1.0-alpha.124

### Fixed

- **Comment delivery** — `draft send` keeps the comments the forge did not take.

  <details><summary>What was wrong</summary>

  A send the forge only partly accepted deleted every draft it had asked about and reported success, so comments the pull request never received were gone from disk. Only drafts the forge names back are cleared; the rest stay held, the answer says how many landed and how many are still waiting, and sending again sends only those. A reply adiff cannot read confirms nothing rather than everything.

  </details>

- **Comment delivery** — two sends at once post one review, not two identical ones.

  <details><summary>What was wrong</summary>

  They used to race, each reading the whole set and each posting it. A send now holds a lock across the whole cycle, and a second one finds nothing left to send.

  </details>

## 0.1.0-alpha.123

### Fixed

- **Diff** — a change you can only see in the whitespace is marked.

  <details><summary>What was wrong</summary>

  Adding a trailing space, or turning spaces into a tab, showed a removed line and an added line that read identically. Trailing spaces and tabs on a changed line are marked now. Copying still takes the bytes that are in the file.

  </details>

## 0.1.0-alpha.122

### Fixed

- **Diff** — a file with no newline at the end says so.

  <details><summary>What was wrong</summary>

  git reports it and adiff dropped the line, so a change to a file's last byte showed as two lines that read identically with nothing to tell them apart.

  </details>

- **Store** — the lock around a review's state is patient enough for a loaded machine.

  <details><summary>What was wrong</summary>

  Four writers arriving at once on a busy box could exhaust its retries and lose a write.

  </details>

## 0.1.0-alpha.120

### Fixed

- **Diff** — copying across a collapsed gap no longer puts adiff's own `⋯ 103 lines hidden` marker on the clipboard.

- **Diff** — `y` copies the selection you made even when the cursor is resting on a comment.

- **Footer** — the two numbers on screen say what they count — `4 lines selected` against `2 lines copied`.

  <details><summary>Why they differ</summary>

  A change shows both its old and its new line, and copy takes the one you are keeping.

  </details>

## 0.1.0-alpha.119

### Fixed

- **Diff** — a collapsed gap says what its keys do — `⋯ 26 lines hidden · l opens 10, F opens all`.

  <details><summary>What was wrong</summary>

  The old text did not say that `l` reveals ten at a time, so on a large gap it looked like nothing was happening, and it never mentioned `F`, which opens the whole file at once. A gap smaller than one press now says `l opens them`.

  </details>

## 0.1.0-alpha.118

### Fixed

- **Review panel** — a comment you take back is called removed everywhere.

  <details><summary>What was wrong</summary>

  The key called it "remove", the review panel called it "Withdrawn" and the command line called it `remove`/`restore` — three words for one act. The terminal now says what the command line says.

  </details>

- **CLI** — `adiff branch list` calls comments the agent has not answered `unanswered`.

  <details><summary>What was wrong</summary>

  `unread` meant two different things in two answers: on a branch it counted comments the agent had not answered, and on a thread it counted answers the reviewer had not read. `unanswered` is what the screen already labelled it.

  </details>

## 0.1.0-alpha.117

### Fixed

- **Diff** — a binary file says it is binary instead of drawing an empty pane.

  <details><summary>What was wrong</summary>

  git reports it as changed and adiff listed it in the file tree, but opening it showed a pane with nothing in it — indistinguishable from a rendering failure.

  </details>

## 0.1.0-alpha.116

### Fixed

- **Keys** — `g`, `G` and the page keys move the pane you are looking at.

  <details><summary>What was wrong</summary>

  With the file list or the review panel focused they moved the diff cursor instead — invisibly, since you were not looking at the diff — so the only way through a long list was one row at a time. Sixty presses from the bottom of a forty-layer rail to the top.

  </details>

- **Layers rail** — `f` hides files already reviewed while you read layers, as it already did in the file tree.

  <details><summary>What was wrong</summary>

  The same key did something in one rail and nothing in the other, and the header count disagreed with what was on screen.

  </details>

- **Review panel** — a comment on a line hidden inside a collapsed gap can be reached.

  <details><summary>What was wrong</summary>

  It said the comment was outside the diff while the file it belongs to was open on screen. It now opens the gaps and goes there.

  </details>

## 0.1.0-alpha.115

- Caches that outlived the process now live inside the layer that owns them, so a reload after the agent commits reads the real base rather than one remembered from earlier. The store's rename guard was set before the rename it guards, so a second reader could take the path the file had just left; it is a proper cache now, and a second reader waits.

  Child processes are killed when the work that started them is interrupted. Leaving the review used to leave `gh` running behind it, and a cancelled upgrade could orphan a long install.

  A truncated session file no longer crashes the terminal on launch, the store encodes what it writes through the same schema it decodes what it reads with, and several closed unions became switches so that adding a case fails the build rather than falling through.

## 0.1.0-alpha.114

- A comment you withdrew can be brought back from the terminal. `X` used to be a one-key destructive action with no confirm, no undo and no trace — the thread vanished from the diff, from the review panel and from the file counts, and the only way back was a CLI command the message named but the terminal could not run. A withdrawn thread now sits under "Withdrawn" in the review, out of the diff, and `X` on it brings it back.

## 0.1.0-alpha.113

- The reply box shows the thread you are answering. It used to quote code from wherever the diff cursor happened to be — often a different file — and never showed your comment or the agent's answer, so you replied to a question you could not see. It now shows the conversation, and names the range rather than only its last line.

  The header says when a line runs off the right of the pane. Code was cut with no marker of any kind, so two lines that differ only past the edge looked identical.

## 0.1.0-alpha.112

- The review panel says what state a thread is in. A question the agent asked back — the one thing that stops the review until you answer — was filed under "Answered" with the same mark as an ordinary answer. It now has a section of its own at the top, and settled threads have one at the bottom instead of sitting in place with one glyph missing. When there are more threads than fit, the panel says how many are above and below rather than ending mid-list.

  The box a comment is written in stays on screen. Past about seven hundred characters at 80x24 it grew through the pane border, the send hint and the footer, and you carried on typing with the caret off the bottom of the terminal.

  `a` says the terminal is too narrow for the review panel every time, not only the first — it used to toggle an invisible flag and look dead. A path that is not a git repository says so, instead of "nothing to review". The key sheet no longer says "4 of them" while drawing three. And the key sheet and the command palette answer to the words a reviewer would actually type: `resolve` finds settle, `search` finds find, `shortcuts` finds the key sheet.

## 0.1.0-alpha.111

- Removes code nothing called any more, and gives each duplicated constant one home. Nothing about what adiff does changes.

## 0.1.0-alpha.110

- A comment now quotes only the lines it says it is about. A selection that crossed a change stored the old and the new version of every changed line in its snippet while naming only the new side, so the agent was handed code that is not at those line numbers in either version of the file. `--side old` was worse: it silently became a new-side comment on a different line.

  Two writes to one review at the same moment both land. Settling in the terminal while the agent answered from the worktree lost one of them and reported success for both; at twelve at once, five of twelve survived.

  `draft send` no longer throws away a draft written while it was sending, reports what the forge actually took rather than what it was handed, and posts a range as a range instead of a comment on its last line.

  The key sheet names every key a command answers to, so `j` and `k` are findable, and it can be searched by key as well as by name. The footer says how to move before anything else, keeps the highest-ranked keys when the terminal is narrow rather than the last ones, and always keeps the two ways out.

## 0.1.0-alpha.109

- The line under the cursor, and the lines in a selection, keep their colour. It used to be repainted a flat grey with a bright blue gutter, so on the one line you were looking at you could not tell whether it had been added or deleted — the `+` sat at 1.18:1 against its own background. The cursor and the selection now lift the line's own tint instead of replacing it, and the line numbers were lifted out of the 1.6:1 they sat at on a tinted row. Comment bodies are no longer the dimmest text on the screen: they were 3.9:1 while the agent's narration beside them was 8.2:1, which had it backwards.

- The two counters in the header no longer look like the same number. `2/14  3/14 reviewed` put a position and a progress fraction two spaces apart in one colour, with different denominators when a file sat in more than one layer. They now read `file 2 of 14` and `3 reviewed`.

- An option value that begins with two dashes is kept rather than thrown away. `--body "--force is risky here"` used to store the word `true` and report success, so the comment the reviewer wrote was silently replaced. Options can also be written as `--name=value`.

  adiff now refuses what it used to swallow: an option a command does not take, a `--side` that is neither `old` nor `new`, a line number that is not a whole number, and a `--fields` name the answer does not carry. Each refusal names what was given and what is allowed. `--fields` itself is now listed by `adiff describe`, and the nine failures that used to report "Unexpected failure, try again" — an unreachable forge, a git command that failed, a store file that could not be read — say what actually went wrong and that retrying will not help.

- Four things a bug bash of the review terminal turned up.

  Copying a selection that crosses a change put both versions of every changed line on the clipboard, so the paste was code that existed in neither version of the file. It now copies the version being kept, and still copies deleted lines when that is all you picked.

  A comment you were part way through writing is no longer thrown away when the box closes. Escape or ctrl+c keeps it, and reopening on the same lines brings it back. A comment of nothing but spaces is refused with a message instead of reaching the agent as an empty thread.

  A terminal too narrow to draw the review in used to leave it blank for good, with no way back short of restarting. It says it needs more room, and comes back when the terminal does.

- Wrapped lines follow the pane when it grows. Hiding the rails with `z` widened the diff from 66 columns to 148 and the text kept breaking at 62, so the one key that buys the most room did nothing for anyone reading with wrapping on.

## 0.1.0-alpha.108

- `L` in the review asks the agent for a reading order. If the branch has none it asks for one, if the one it has describes an older commit it says so and asks for a fresh read, and otherwise it asks for a revision. The request arrives as an ordinary comment, so the agent picks it up the way it picks up everything else.

- Comments on somebody else's pull request can be drafted rather than sent. `adiff draft add`, `edit`, `drop` and `list` hold a set of comments against a branch, and `adiff draft send` posts them to the pull request as one review. Nothing reaches the forge until it is sent; a pull request that moved, or a forge that cannot be reached, refuses the send and keeps every draft. The agent can read and write drafts and cannot send — the reviewer signs the review.

## 0.1.0-alpha.107

- The key that swaps the rail says where it would take you — `s file tree` while you are reading layers, `s layers` while you are reading files — and it is offered from the diff as well as from the rail. A layer set that has gone stale says so in the header, so you can see it from the file tree and not only from the layers rail.

## 0.1.0-alpha.106

- Layers read as chapters. The rail no longer repeats each layer's note word for word — the diff already shows it above the code it describes — and prints the reading order instead: a numbered title, the directories the layer touches, and the file names under them, with a tick against the ones you have read. It expands as many layers as fit rather than collapsing all but one, marks the current file in the accent colour, and says how many layers sit above and below.

- Making the terminal smaller no longer blanks the review for good. Every panel kept its old width, the draw underneath failed, and nothing was drawn again until adiff was restarted. Mark-and-go-to-next also stopped un-marking a file that was already reviewed.

- `layers set` says which layer it would not take and why, instead of one sentence for five different mistakes. Spans that end before they start, or start before line one, are refused rather than dropped in silence; a layer given both spans and blocks keeps both; `./src/one.ts` is the same path as `src/one.ts`; and `layers show` reports covered, partial and vanished for each layer, not only for the document as a whole.

- A layer in the rail is a card: its title, what it says, and the files it covers, each ticked off as it is reviewed, with a count of how many are done. `]` and `[` walk that reading order from one layer into the next, and switching to the file tree survives a reload.

- Walking a layered review reaches the end of it. Two layers naming the same file used to send `]` and `[` back to the first layer that claimed it, leaving the tail of the review unreachable, and the header counted a file once per layer that mentioned it.

## 0.1.0-alpha.105

- Looking for something no longer re-reads the whole branch on every search, and finds a name however it was capitalised.

## 0.1.0-alpha.104

- Looking for something shows the places as the words are typed, keeps a readable panel before there is anything to show, and never reads the clipboard.

## 0.1.0-alpha.103

- Looking for something opens a box to type in, filled from the clipboard or from what the mouse picked, rather than guessing a name from the selected line. Matches are grouped under the file they are in, and the one under the cursor shows the lines around it.

## 0.1.0-alpha.102

- `?` opens the key sheet again, along with every other binding that is a shifted character: `{`, `}`, `<`, `>`, `+` and `_`.

## 0.1.0-alpha.101

- Ctrl+C on the review says what a second press will do rather than leaving at once, and `adiff config set` refuses a value that is not on or off instead of reading it as off.

## 0.1.0-alpha.100

- A gap hiding a single line is opened as the file is read, rather than spending a row of the screen to say one line is hidden.

## 0.1.0-alpha.99

- What a search found can be narrowed by typing, and each match shows the end of its path and the line it matched rather than a long path cut at the edge.

## 0.1.0-alpha.98

- Finding the selection elsewhere looks for the words the reviewer picked, rather than the longest name on the line they were picked from.

- The file list and the review panel say which of them the keys will reach by how brightly the row under their cursor is lit, rather than with a small glyph beside it.

## 0.1.0-alpha.97

- Every release writes its changes into CHANGELOG.md and says them on the release page, rather than only in an install line.

- Clicking a line puts the cursor on it rather than selecting it, so the arrows afterwards move the cursor and the diff stays where it is.

- Settling or removing a thread from the review panel leaves the cursor where it was, rather than sending it back to the first thread.

## 0.1.0-alpha.96

- Ctrl+C closes the box, key sheet, palette or search that is open over the review, and only leaves adiff when nothing is open over it.

## 0.1.0-alpha.95

- adiff keeps preferences between sessions: wrapping, the sticky heading, the review panel, hiding files already reviewed, hiding settled threads, and the order the review reads in. `adiff config list`, `config get` and `config set` read and write them, and the review remembers a toggle made with a key.

## 0.1.0-alpha.94

- The worktrees are read together rather than one after another, taking about 290ms off opening a review on a machine holding thirteen of them.

## 0.1.0-alpha.93

- Opening a review no longer waits on GitHub before drawing the diff, taking about 2.85s down to about 1.5s on a branch of 131 files.

## 0.1.0-alpha.92

- Opening the hidden lines in a diff reads that one file at whole-file context rather than every file on the branch.

## 0.1.0-alpha.91

- Prose a layer writes about deleted code is shown beside that code, rather than dropped because the file has no new side.

## 0.1.0-alpha.90

- The summary an agent writes with `layers set` is shown above the layers in the review, rather than only in JSON.

## 0.1.0-alpha.89

- The worktree list shows the full name of the branch a review is stacked on, rather than cutting it into something that looks like a different branch.

## 0.1.0-alpha.88

- Sending a comment, settling a thread and removing one no longer re-read the whole branch from git. On a branch of 131 files: sending 220ms to 72ms, settling 162ms to 37ms, removing 171ms to 38ms.

## 0.1.0-alpha.87

- Marking a file reviewed no longer re-reads the whole branch from git, taking it from about 124ms to about 37ms on a branch of 131 files.

## 0.1.0-alpha.86

- Turning past the last file says "last file" instead of doing nothing, and the same at the first file going back.

## 0.1.0-alpha.85

- Page Up, Page Down, Home and End now move through a diff, doing what ctrl+u, ctrl+d, g and G already did.

## 0.1.0-alpha.84

- The count in the header follows the order `[` and `]` move in, so it steps by one instead of jumping about, and a branch named on the command line opens at the top of its tree rather than partway down it.

## 0.1.0-alpha.83

- A thread is redrawn when an answer or a reply lands in it, rather than staying as it was until the branch is read again. A thread the reviewer wrote back to now says it is with the agent instead of claiming it was answered.

## 0.1.0-alpha.82

- A reviewer can write back to an answer. Press `R` on a thread, in the diff or in the review panel, and the reply continues that thread rather than opening a second one about the same line. It reaches the agent through `comment take` like any other comment, carrying the conversation so far, and `adiff comment reply --to <id>` does the same from the command line.

## 0.1.0-alpha.81

- Opening a branch asks git for its diff once rather than four times over, which takes about forty milliseconds off every branch opened or reopened.

## 0.1.0-alpha.80

- A review opened on a named branch waits for that branch rather than for every worktree on the machine, and reads what the branch is made of at once. On a branch of 131 files that is 2.8 seconds down to 1.8.

## 0.1.0-alpha.79

- Opening a review on a branch named on the command line, or coming back to one you left, lands on a row you can comment on rather than on the row standing for hidden lines.

## 0.1.0-alpha.78

- Naming a branch no worktree here is on says so, rather than landing on the worktree list with no word about it.

- A file opens on a line rather than on the row standing for the ones it hides, so the first `c` in a file has something to comment on. `]` and `[` walk every file the branch changed, even when the folder holding them is closed.

- The worktree list is read all at once rather than one worktree after another, so it arrives in about a third of the time on a machine with a dozen of them. The file tree gives its width to names rather than to indenting, and keeps more of them whole.

## 0.1.0-alpha.77

- Copying reaches the clipboard inside tmux and screen, and on Linux and Windows rather than only on a Mac. The terminal is handed back if the review fails to open. The parser the diff is coloured by is shut down with the screen.

## 0.1.0-alpha.76

- The filter above the palette and the sheet of keys is a real text box now, like the one a comment is written in: a caret you can move, word jumps, and selection. `return` in a comment belongs to the box, so `shift+return` breaks a line rather than doing nothing.

## 0.1.0-alpha.75

- The suite runs in three parts at once, so a change reaches a release in about half the time it took.

- Cmd and option in the compose box now do what they do everywhere else: cmd moves to the ends of a line or the draft, option moves by word, and a key held with a modifier is never typed. Letting go of shift after growing a selection opens the comment on it.

- The box a comment is written in is opentui's textarea now, rather than one written here: the caret is the terminal's own, and undo, selection, and word and line movement come with it. Cmd and option keys the box does not carry by default are added to it.

## 0.1.0-alpha.74

- The box a comment is written in behaves like one: the caret is the cell it stands on rather than a character shifting the words, and the arrows move a line at a time through the wrap. `shift` with an arrow grows the selection to comment on.

## 0.1.0-alpha.73

- The README is short: install, `adiff init --write --skill`, and ask your agent to onboard you. The full handover with layers and coverage moved to `docs/handover.md`. The compose panel no longer offers a key that was removed.

- Everything drawn on the screen can be selected and copied, including the palette, the sheet of keys and the search results, which were drawn by a widget that hid its text. A selection clears on the next key. The row the cursor is on is washed rather than dotted, and the arrows walk between files.

## 0.1.0-alpha.72

- Dragging inside one line copies the characters it covered. The wheel belongs to the review again, so scrolling and then pressing an arrow no longer throws the view back. `S` turns the pinned scope off. Settling from the panel keeps the cursor on the thread it settled.

## 0.1.0-alpha.71

- `f` on the review panel hides the threads already settled, the way it hides files already read on the file list. The same key puts away what is done in whichever pane is in focus.

## 0.1.0-alpha.70

- The published binary is attached to the release compressed as well as raw, and Homebrew and `adiff upgrade` both take the compressed one. An install downloads about 25MB rather than 73MB, and unpacks to the same binary.

- Dragging over the code itself copies it, not only over the line numbers. Turning to another file starts at the top of it rather than keeping where the last one was scrolled to. A bug report names the adiff version it came from.

## 0.1.0-alpha.69

- A comment whose lines have left the diff can be read, settled and removed from the review panel. Settling or removing a thread marks its answers read, so nothing is left counted as unread once it is closed.

- The footer names the keys of the pane in focus, rather than one row for the whole screen. The sheet behind `?` filters as you type and groups keys narrowly. The wheel moves one row a notch, and an arrow after it moves the cursor into view instead of dragging the view back.

## 0.1.0-alpha.68

- Colours land on the words they belong to: a file edited after the review opened no longer draws old colours over new lines. Loading a grammar no longer holds up the keyboard. The wheel over the file list moves the list, rather than opening each file it passes.

- Dragging over lines in the diff copies them when the drag ends, and they stay selected. `y` copies the line the cursor is on without selecting first, or the whole answer when the cursor is on one. On a Mac the text reaches the pasteboard even when the terminal drops the escape.

- A comment goes to the agent when it is written. Staging one for a review sent later is gone, with the screen that listed what was held back: `comment stage`, `comment edit` and `review send` are removed, `ctrl+s` in the compose panel is the only way out, and `comment send` is the only way to send.

- A comment taller than the screen is walked a page at a time, rather than stepped over in one press. The wheel carries on from where the pane is: the first notch after scrolling past a comment no longer jumps somewhere else.

## 0.1.0-alpha.67

- `f` hides the files you have already reviewed, so a long branch stops being mostly done files. The file you are on stays, whatever its state. Scrolling over the file list now walks it, and the review panel reads newest first with `O` to turn it around.

- `D` settles every answer you have already read, so a long review stops making you scroll past points you are done with. Only threads the agent answered and you opened are settled — nothing unanswered or unread is closed behind your back.

## 0.1.0-alpha.66

- adiff is built on the release candidate of Effect rather than a beta from eight releases back. Nothing about using it changes; the suite runs a little quicker.

## 0.1.0-alpha.65

- A bug report carries the notices you were shown and a clock against every step, so what you saw and how long you sat there survives into the report. The agent skill also stops claiming a comment is handed over once — it now comes back until it is answered.

## 0.1.0-alpha.64

- Typing `adiff` works on a Node older than 26. The launcher moves to a newer Node when a terminal is about to be drawn, and did not know plain `adiff` now draws one. An unexpected failure also says what went wrong rather than nothing.

## 0.1.0-alpha.63

- Selecting lines now shows `y copy` in the footer. adiff holds the mouse while a review is open, so your usual copy shortcut has no terminal selection to act on, and the key that does work was named nowhere you would look.

## 0.1.0-alpha.62

- Panning right reaches the end of a long line. The last few columns sat under the line numbers and the diff sign, and no amount of panning could bring them out, so a wide line always stopped short of wherever it really ended.

## 0.1.0-alpha.61

- Scrolling reaches the end of a file whose comments fill the screen. The wheel counted lines of code and a long answer is one line of code however tall it is drawn, so anything below it was out of reach. Opening a comment from the panel also leaves the panel where you left it.

## 0.1.0-alpha.60

- Typing `adiff` opens the review on the repository you are standing in, rather than printing the help you have already read. Piped output and agents still get the help, so nothing that reads adiff's answers is left waiting on a terminal.

## 0.1.0-alpha.59

- An answer stays unread until you open it, and the count survives reloading the branch. Keys work on a keyboard that is not English: a binding matches the key the letter sits on. Bug reports carry the last twenty moves, and `ctrl+t` sends only the words you typed.

## 0.1.0-alpha.58

- Syntax colour is read from the whole file, so it is right wherever a hunk starts. `}` and `{` step between runs of changed lines and land on the change itself. Opening a comment from the review panel brings the diff to it, or says when that line is not in the diff.

## 0.1.0-alpha.57

- Installing without naming a tag gets the newest version. The release moves the `latest` tag itself now, so nobody has to do it by hand. Publishing the GitHub release retries as well, so a version arrives with its binaries and its Homebrew formula behind it.

## 0.1.0-alpha.56

- A branch stacked on another shows only the work it adds. adiff takes the base to be the branch yours was started from, and `branch list` shows it on each row. Override it with `--base <ref>`, keep one with `adiff base set`, or go back to detection with `adiff base clear`.

## 0.1.0-alpha.55

- The review screen says which pane you are in. Each pane has its own border and the focused one is lit in the accent colour, so exactly one border is bright at a time. `tab` walks the panes left to right, the way they are drawn, and `shift+tab` walks back.

## 0.1.0-alpha.54

- A review follows its branch rather than the folder it was read in. Rename a worktree, or check the same branch out somewhere else, and your comments come with it. Anything written before this is picked up the first time you open the branch.

- A comment the agent collected but never answered is no longer lost. An answer is what retires a comment now, so a dropped one comes back on the next take and keeps coming back until it is answered. The branch list counts what the agent still owes you.

## 0.1.0-alpha.53

- `}` and `{` say when there is nothing further to jump to instead of swallowing the keystroke. The review panel can settle or remove a comment the diff cannot show you. And `… N more` counts what is actually below you rather than promising files that are not there.

## 0.1.0-alpha.52

- Pasting into a comment works. Text lands at the caret in one move, so quoting a stack trace or an error message no longer means retyping it. Line breaks survive in a draft and become spaces in the palette, and anything that could disturb the screen is stripped.

## 0.1.0-alpha.51

- The file list stops ending without saying so. It reserved a row for `… N more` whether or not one was needed, and that row paid for the pane's padding instead, so the count was clipped and the list just stopped. `h` now closes the folder the cursor's file is in and then walks outward one folder per press, with `l` opening them again from the outside in, so a deep tree can be folded down to something that fits.

## 0.1.0-alpha.50

- `adiff upgrade` says the command it ran and the version it landed on, and stops there. It used to open with which package manager installed the build, which registry tag mattered and what it was about to do, which is four paragraphs standing between you and the one fact you asked for. Upgrading now also rewrites the adiff skill wherever it is already installed, so an agent is not left reading last month's instructions; `adiff skill refresh` does that on its own, and neither installs a skill that was not already there.

## 0.1.0-alpha.49

- `z` gives the diff the whole window: it clears the review panel as well as the file list, and pressing it again brings back whatever was there before. The key that hides the panel on its own, `a`, is named in the footer instead of only in the sheet of keys.

## 0.1.0-alpha.48

- `review open` and `review pane` take `--branch`, so an agent handing over a review can name the branch and land the reviewer on its diff rather than on the worktree list. `F` shows the whole file the change sits in and `F` again gives the diff back, returning to whatever context width you had chosen.

- A wide terminal now carries the whole review beside the diff: what you have staged, what the agent already has, and what it has answered, in one panel you can walk with `tab` and open with `enter`. When an answer lands while you are reading, the panel names the comment it answers instead of only counting it, so you can tell whether pulling is worth doing before you press `r`.

- The wheel scrolls the sheet of keys you are looking at rather than the diff behind it. Reading the branch again with `r` keeps the lines you were looking at where they were, instead of moving them to an edge of the pane.

- Writing a comment has a caret: `left` and `right` move it, `alt` with either moves a word, `home` and `end` reach the ends of the line, and typing, `backspace` and `delete` all act where it stands, so fixing a typo near the start of a sentence no longer costs the rest of it.

## 0.1.0-alpha.47

- `adiff upgrade` upgrades. It runs the command for the install it found instead of printing it, shows the package manager working, and ends by naming the version you now have. `--check` reports without running, `--run` still works and does nothing, and a route adiff cannot do for you, a downloaded binary or a checkout, explains why and exits 1.

## 0.1.0-alpha.46

- Make the pull request reachable: p opens it from the review as well as the worktree list, the footer names the key where there is one to open, the review header says which state it is in, and a list that could not ask says so instead of looking like nobody has a pull request.

## 0.1.0-alpha.45

- Use the room a wide terminal has: panels keep a whole command title and a whole match, a tall screen lists more keys, and a long worktree name is read to its end.

## 0.1.0-alpha.44

- A file buried deep in a nested tree can be read: the file list keeps both ends of a name that does not fit, so two files whose names end the same way no longer draw as one row, and the header names the file you are on instead of letting the path run off the edge of the terminal.

## 0.1.0-alpha.43

- Build the Linux release binaries again. The terminal library ships one native package per platform and libc, and pnpm skips the musl ones on a glibc runner, so the compiler could not find the musl library it still has to bundle and both Linux builds stopped there. Installs now take both libc flavours, and every pull request compiles all four binaries and checks they answer with no runtime on PATH, so a broken binary shows up before a release does. The release also tracks the newest Bun rather than a pinned one.

## 0.1.0-alpha.42

- `--help` works on every command and every noun, the top-level list is grouped by what you are trying to do, a mistyped command names the one you meant, and a missing option says which command wanted it.

- Renames on the merits, now that nothing depends on the old names: `comment threads` is `comment list`, `comment add` is `comment send`, `review submit` is `review send`, `file vouch` is `file review`, and `--asks` is `--question`. `comment drop` is gone, folded into `comment remove`. Every command that acts on a review now takes either `--worktree`, or `--repo` with `--branch`.

## 0.1.0-alpha.41

- Build the release binaries with a version of Bun that exists. The workflow asked for 1.4.0, which was never published, so every binary download answered 404. No release since the workflow landed has carried binaries or updated the Homebrew formula.

## 0.1.0-alpha.40

- `adiff upgrade` answers in plain english, starting with what happened: already the newest build, a newer one is out, or the registry never answered. `--json` gives the envelope back to a caller.

## 0.1.0-alpha.39

- `adiff upgrade` works out how this copy was installed and names the one command that updates it, and the terminal mentions a newer version once in the footer without ever checking on a command's path.

## 0.1.0-alpha.38

- adiff --version answers from a version built into the bundle rather than a package.json found beside it, and a Bun runtime opens the terminal itself instead of going looking for a Node it does not need.

## 0.1.0-alpha.37

- The footer carries the keys a review is made of, and ? lists every key the screen answers to.

## 0.1.0-alpha.36

- A review belongs to the branch it describes, the worktree list names the repository it opened and marks where you are, and the pull request opens from the list.

## 0.1.0-alpha.35

- A comment can be removed from the review and restored, and the record keeps it either way.

## 0.1.0-alpha.34

- A file name too long for the tree keeps its end, where the extension and the distinguishing word live.

## 0.1.0-alpha.33

- The store reports a damaged file instead of failing unexpectedly.

## 0.1.0-alpha.32

- The skill publishes a reading order on request, and tells the reviewer how to open the review.

## 0.1.0-alpha.31

- Coverage counts the changed lines a layer claims, not the hunks a span touches.

## 0.1.0-alpha.30

- The palette keeps a command's name clear of its category.

## 0.1.0-alpha.29

- First contact teaches the loop, an empty collection says what to do next, and a worktree error explains the path.

## 0.1.0-alpha.28

- An agent can open the review in a split pane beside the conversation.

## 0.1.0-alpha.27

- adiff init writes the review loop into a repository's agent instructions.

## 0.1.0-alpha.26

- A branch with no files left to read says so.

## 0.1.0-alpha.25

- The terminal names the key that sends a review, and counts what is waiting.

- The repository's own working tree is reviewable and marked here.

## 0.1.0-alpha.24

- A selection can be copied, or searched for across the branch's worktree with the matches listed and peeked at.

## 0.1.0-alpha.23

- A pinned scope wider than the pane can be panned into view, and the command palette opens over the review list.

## 0.1.0-alpha.22

- A selection reaching over hidden lines reports the range it will actually comment on.

- Composing on a row that carries no line says so instead of opening a panel that cannot send.

- The stale mark on the layer rail reads in full at any width.

## 0.1.0-alpha.21

- The store answers with the settings effect directly.

## 0.1.0-alpha.20

- Homebrew tracks each release.

## 0.1.0-alpha.19

- The house style lives in the linter, and a thread can be settled and folded from the terminal.

## 0.1.0-alpha.18

- The cursor stops on a thread so it can be settled directly, and a settled thread folds to one row.

## 0.1.0-alpha.17

- Say when an agent answers, settle a thread with d, and hold the comments still while the code pans.

## 0.1.0-alpha.16

- r reads the worktree list again, and notices reach the home screen.

## 0.1.0-alpha.15

- Pan the diff sideways to read past the right edge.

- The footer keeps the way out visible on a narrow terminal.

- Wrapping keeps every character and is remembered between sessions.

## 0.1.0-alpha.14

- V selects the change under the cursor, o grows a selection from its other end, and g and G reach the ends of the worktree list.

- w wraps long lines in the diff, and the cursor gutter stops at the last line.

## 0.1.0-alpha.13

- Reword or withdraw a staged comment, and see when a thread describes an older commit.

## 0.1.0-alpha.12

- An agent can answer a comment, and a reviewer can settle the thread.

## 0.1.0-alpha.11

- r reads the branch again, so the agent's newest work appears without leaving the review.

## 0.1.0-alpha.10

- The rail shows a layer's prose block by block, each above the file it introduces.

- layers show says a stale layer set needs a new revision.

## 0.1.0-alpha.9

- A seeded layer covers two files, so the demo shows what a layer spanning files looks like.

## 0.1.0-alpha.8

- The simulator seeds layers, so a demo run shows them.

- The worktree list says whether a branch already has a pull request.

## 0.1.0-alpha.7

- A layer's prose reads in the diff, above the code it introduces.

## 0.1.0-alpha.6

- The diff holds still when a trackpad gesture drifts sideways.

- The reading order an agent writes is called layers. adiff layers set and adiff layers show replace the story verbs, and the JSON carries layers where it carried steps.

- A layer lists the files it covers, and the footer says how to switch between layers and files.

## 0.1.0-alpha.5

- Wheel bursts move the diff once a frame, the worktree list shows which branches carry a reading order, and a story the branch has moved past says so.

- Scrolling with a trackpad settles as soon as your fingers stop.

## 0.1.0-alpha.4

- Open the lines a diff leaves out one gap at a time with l, and put them away with h.

## 0.1.0-alpha.3

- The comment panel grows to fit what you write, so a long line wraps inside it and a new line is always visible.

- Commands run on Node 22 and up, and opening the terminal finds a Node 26 on your machine.

- The review sidebar lets you open a story step to read the prose behind it, and wraps long step titles instead of cutting them off.

## 0.1.0-alpha.2

- Ship the CLI as a bundled JavaScript file so a global install runs, and starts in about half the time.

## 0.1.0-alpha.1

- Simulation data reads like a real product, and the README is written for a first-time reader.

## 0.1.0-alpha.0

- Mark files reviewed from the terminal, with progress in the header and the tree.

- Fix the render crash on large diffs; the terminal now owns scrolling. Expandable context, and simulator variants.

- The pinned scope lines up with the code it names.

- Review what is staged before sending it, and send the batch from the terminal.

- Every letter is typeable in a comment, and commented lines are marked in the gutter.

- Navigate a long diff: g/G, half-page scroll, and hunk jumps.

- A coherent theme: fewer hues, more contrast levels, semantic names.

- Footer chips with key glyphs, a selection readout, and messages that expire.

- Separate panes with a rule, switch focus with tab, and zoom the diff.

- Sticky scope: the whole enclosing chain, read from the file rather than the diff.

- Compose shows the code being commented on, takes multiple lines, and can stage.

- Pin the right scope, align the sign column and the tree, and say when lines are hidden.

- Review a diff by the argument instead of the filesystem. An agent writes a story over its own
  worktree with `adiff story set`, and the review terminal lists its numbered steps in place of the
  file tree, scoping the diff to the step you are on. adiff computes coverage itself, so the hunks no
  step claims are reported by `adiff story show` and shown to the reviewer under "not in any step".

- Own the diff rendering: one parse per file, no highlight flash on scroll.

- First alpha of the review terminal and the agent hand-over.

- The pinned scope keeps its syntax highlighting; the simulator ships with comments already on it.

- File tree navigation, and GitHub-style review batching with comment stage / review submit.

- The branch list shows which branches have work waiting, and refreshes when you return to it.

- Simulate large branches, and keep the file list usable at that size.

- Per-directory tree folding, with crowded directories closed on open.

- Mouse wheel scrolling, drag selection, and a file tree that reads like the prototype's.

- ctrl+b writes a bug report with the surrounding context and copies it to the clipboard.

- Command palette and sticky scope in the review terminal.

- Agent-readable command surface: noun-verb commands, compact JSON, failures on stderr with actionable exit codes, --fields projection, and describe.
