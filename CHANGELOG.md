# Changelog

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

## 0.1.0-alpha.9

- A seeded layer covers two files, so the demo shows what a layer spanning files looks like.

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

## 0.1.0-alpha.8

- The simulator seeds layers, so a demo run shows them.

- The worktree list says whether a branch already has a pull request.

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

## 0.1.0-alpha.7

- A layer's prose reads in the diff, above the code it introduces.

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

## 0.1.0-alpha.6

- The diff holds still when a trackpad gesture drifts sideways.

- The reading order an agent writes is called layers. adiff layers set and adiff layers show replace the story verbs, and the JSON carries layers where it carried steps.

- A layer lists the files it covers, and the footer says how to switch between layers and files.

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

## 0.1.0-alpha.5

- Wheel bursts move the diff once a frame, the worktree list shows which branches carry a reading order, and a story the branch has moved past says so.

- Scrolling with a trackpad settles as soon as your fingers stop.

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

## 0.1.0-alpha.4

- Open the lines a diff leaves out one gap at a time with l, and put them away with h.

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

## 0.1.0-alpha.3

- The comment panel grows to fit what you write, so a long line wraps inside it and a new line is always visible.

- Commands run on Node 22 and up, and opening the terminal finds a Node 26 on your machine.

- The review sidebar lets you open a story step to read the prose behind it, and wraps long step titles instead of cutting them off.

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

## 0.1.0-alpha.2

- Ship the CLI as a bundled JavaScript file so a global install runs, and starts in about half the time.

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

## 0.1.0-alpha.123

- A change you can only see in the whitespace is now visible. Adding a trailing space or turning spaces into a tab showed a removed line and an added line that read identically, with nothing to tell them apart. Trailing spaces and tabs on a changed line are marked. Copying still takes the bytes that are in the file.

## 0.1.0-alpha.122

- A file with no newline at the end says so. git reports it and adiff dropped the line, so the change to a file's last byte showed as two lines that read identically with nothing to tell them apart.
  
  The lock around a review's state is patient enough for a loaded machine. Four writers arriving at once on a busy box could exhaust its retries and lose a write.

## 0.1.0-alpha.121

- Nothing about what adiff does changes. The test suite stopped repeating two setups 350 times, stopped reaching into functions no reviewer or agent can see, and stopped leaking `PATH` and a stub HTTP server between tests in the same worker. One existing test was writing to a store key nothing reads and passing anyway; it now derives the key from the store.

## 0.1.0-alpha.120

- Copying a selection that crosses a collapsed gap no longer puts adiff's own `⋯ 103 lines hidden` marker on the clipboard as if it were source. `y` also stops discarding a selection you made because the cursor happens to be resting on a comment — with a selection active it copies the selection.
  
  The two numbers on screen say what they count. The footer now reads `4 lines selected` and the toast `2 lines copied`, which is honest about the difference: a change shows both its old and its new line, and copy takes the one you are keeping.

## 0.1.0-alpha.12

- An agent can answer a comment, and a reviewer can settle the thread.

## 0.1.0-alpha.119

- A gap says what the keys do to it. `⋯ 26 lines hidden · press l` did not say that `l` reveals ten at a time, so on a large gap it looked like nothing was happening, and it never mentioned `F`, which opens the whole file at once. It now reads `⋯ 26 lines hidden · l opens 10, F opens all`, and when the gap is smaller than one press it says `l opens them`.

## 0.1.0-alpha.118

- One word per idea. A comment you take back was called "remove" by the key, "Withdrawn" by the review panel and `remove`/`restore` by the command line — three words for one act. The terminal now says what the command line says.
  
  `unread` meant two different things in two answers: on a branch it counted comments the agent had not answered, and on a thread it counted answers the reviewer had not read. `adiff branch list` now calls its one `unanswered`, which is what the screen already labelled it.

## 0.1.0-alpha.117

- A binary file says it is binary instead of drawing an empty pane. git reports it as changed and adiff listed it in the file tree, but opening it showed a pane with nothing in it — indistinguishable from a rendering failure.

## 0.1.0-alpha.116

- `g`, `G` and the page keys move whatever pane has focus. With the file list or the review panel focused they moved the diff cursor instead — invisibly, since you were not looking at the diff — so the only way through a long list was one row at a time. Sixty presses to get from the bottom of a forty-layer rail to the top.
  
  Hiding reviewed files now works while reading layers. `f` was honoured by the file tree and ignored by the layers rail, so the same key did something in one rail and nothing in the other, and the header count disagreed with what you could see.
  
  A comment on a line that is hidden inside a collapsed gap can be reached from the review panel. It used to say the comment was outside the diff while the file it belongs to was open on screen; it now opens the gaps and goes there.

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

## 0.1.0-alpha.11

- r reads the branch again, so the agent's newest work appears without leaving the review.

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

## 0.1.0-alpha.10

- The rail shows a layer's prose block by block, each above the file it introduces.

- layers show says a stale layer set needs a new revision.

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
