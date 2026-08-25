# PRD-003 — Review terminal

> The screen the reviewer reads a diff on, selects lines in, and writes comments from.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-23

## Problem Statement

`git diff` in a terminal is unhighlighted, unnavigable, and offers nowhere to put a reaction. The
reviewer reads it, forms an opinion, switches to another window, and reconstructs the location in
prose. The reading and the reacting happen in different places, and the reconstruction is where the
detail gets lost.

## Solution

adiff opens on the [branches](CONTEXT.md#branch) with something to review. Opening one shows its
files and the diff of the selected file, syntax highlighted, with a cursor the reviewer moves down
the change. Selecting a range and pressing a key opens a compose box; sending it files the
[comment](CONTEXT.md#comment) against that branch.

The screen shows what is needed to act and nothing else. Every key available in the current context
is listed in the footer, so nothing has to be memorised or discovered.

## User Stories

1. As a `reviewer`, I want the diff highlighted, so that I can read it like code rather than like
   output.
2. As a `reviewer`, I want to move a cursor down the change and select a range, so that pointing
   at code is a keystroke and not a description.
3. As a `reviewer`, I want the keys for wherever I am shown to me, so that I never have to
   remember a mode.
4. As a `reviewer`, I want to move between the files of a branch without going back to a list, so
   that reviewing a ten-file branch is one continuous pass.
5. As a `reviewer`, I want to leave without sending, so that starting to write a comment is not a
   commitment.
6. As a `reviewer`, I want to open the lines a diff leaves out at one place without opening them
   everywhere, so that reading three lines above one hunk costs three lines and not a whole file.
7. As a `reviewer`, I want to pick up the agent's newest work without leaving the review, so that
   the diff I am reading is the code that exists.
8. As a `reviewer`, I want a comment to be sent when I finish writing it, so that reviewing is one
   move and not two.
9. As a `reviewer`, I want the footer to carry the few keys I reach for and one key that lists the
   rest, so that the row I read constantly stays short enough to read.
10. As a `reviewer`, I want every command I find to name the key that runs it, so that finding it
    once teaches me how to run it next time.
11. As a `reviewer`, I want every comment I have written on this branch in one place, so that I can
    see the shape of the review I am handing over rather than reconstruct it file by file.
12. As a `reviewer`, I want to fix a word in the middle of what I am writing, so that a typo costs
    one keystroke rather than the rest of the sentence.

## Implementation Decisions

### Owns

Screen composition, key bindings, cursor and selection state, and the transition between the
branch list, the diff, and the compose box.

### Does not own

Row and line semantics ([PRD 002](002-diff-and-anchoring.md)); what happens to a submitted comment
([PRD 004](004-comment-delivery.md)); the command each key ultimately runs
([PRD 007](007-command-surface.md)).

### Public contract

Three screens, and the keys each answers to:

| Screen | Keys |
| --- | --- |
| Branches | `j`/`down`, `k`/`up` move · `g`/`G` first and last · `enter` opens · `q` quits |
| Review | `j`/`down`, `k`/`up` move the cursor · `F` shows the whole file · `[`/`]` previous and next file · `l`/`h` open and close what the cursor is on · `v` starts a selection · `V` selects the change under the cursor · `c`/`enter` composes · `y` copies it · `/` finds it elsewhere · `w` wraps long lines · `a` shows the review panel · `tab` moves between the panes left to right, `shift+tab` back · `esc` returns to branches · `q` quits |
| Found | `j`/`down`, `k`/`up` move between matches · `enter` opens the file · `esc` returns |
| Compose | typing edits the draft at the caret · a paste lands there whole · `left`/`right` move it, `alt` with either moves a word · `home`/`end` reach the ends of the line · `backspace`/`delete` remove either side of it · `ctrl+s` sends · `esc` discards |
| Review list | `j`/`down`, `k`/`up` move · `e` rewords · `X` withdraws · `ctrl+s` sends the review · `esc` returns |
| Keys | `?` opens it · `j`/`down`, `k`/`up` move · `enter` runs the command · `esc` returns |

- **`tab` walks the panes the way they are drawn, and `shift+tab` walks back.** The cycle used to
  start in the middle and jump to the left pane, then across to the right, which is an order no one
  can predict from looking at the screen. It follows the panes left to right now, and the reverse
  key exists because a cycle you can only go forward through makes overshooting cost two more
  presses. A pane that is not on the screen is not in the cycle, and `tab` never brings one back:
  a reader who hid the file list with `t` asked for the room, and having `tab` hand it back took
  the room away on the way to the pane they were reaching for.

- **Each pane is drawn in its own border, and the focused one is lit.** One frame around everything
  with rules between the panes drew the seams but never said which side of them the keys were going
  to. Since `tab` moves between three panes and most keys mean something different in each, where
  the focus is, is the thing the screen most needs to answer, and a reviewer should not have to
  press a key to find out. The three panes are separate boxes now: the one holding the focus takes
  the accent colour on its border and the others stay at the rule colour, so exactly one border is
  lit at any time. The branch list is one pane and answers to no focus, so it keeps its plain frame.

- **A key is the key it sits on, not the letter it types.** A reviewer on a Hebrew or Russian
  layout presses the key where `s` is and the terminal sends a letter that is bound to nothing, so
  the review answers to none of its keys. Terminals that speak the kitty keyboard protocol report
  the key under the letter alongside it, and that is what a binding is matched against. Typing is
  unaffected: what reaches a comment is still the letter that was typed.

- **The wheel over the file list moves the list, not the file.** A branch of forty files is taller
  than the pane, and looking further down it should not mean opening every file on the way: each one
  loads a diff the reader did not ask for. The file being read stays where it is, and the list holds
  wherever it was left until the reader picks another file, at which point it follows again.

- **A row is coloured only while its source line still says what the row says.** Colour comes from
  parsing the whole file, and the file is read from the worktree while the rows come from the diff
  taken when the review opened. An edit between the two shifts every line after it, and colours drawn
  by line number then land on the wrong words. A row whose source line no longer matches is left
  plain, which reads as unfinished rather than as wrong.

- **Colouring a file waits on nothing the reader is doing.** A grammar is fetched the first time a
  kind of file is opened, and reading it took as long as it took while every key pressed in the
  meantime waited behind it. The colour pass runs beside the review instead, and the file that has
  been left is dropped rather than drawn over the one now on screen.

- **Both sides of a thread are drawn by one rule.** A line break the writer typed is a line break on
  screen, for the reviewer's comment, the agent's answer and the reply alike. Answers were flattened
  to a single paragraph, which turned a bulleted answer into a run-on sentence while the comment
  above it kept its shape.

- **A comment taller than the pane is walked through, not stepped over.** A long answer is one stop
  for the cursor, and one press used to carry the reader from its first line to the line below its
  last, with everything between it readable only by wheel. While a stop is taller than the pane the
  same press moves a page down it, and the press that reaches its end is the one that leaves it.

- **Turning to another file starts at the top of it.** Where the last file had been scrolled to is
  a place in that file and means nothing in this one, so the pane, the file list and the selection
  all begin again with the file rather than carrying a position across it.

- **An arrow pressed after the wheel moves the cursor, not the view.** Scrolling leaves the cursor
  somewhere off screen, and moving it from there dragged the view back to wherever it had been
  reading before. The cursor comes to the row the reader is looking at — the top of the pane, or the
  bottom if it was left below — and moves from there, leaving what is on screen where it is.

- **A notch of the wheel is one row.** A trackpad reports many small events for one push, and
  multiplying each of them moved the diff in jumps a reader had to re-find their place after. One
  row a notch reads like every other pane in the terminal, and a fast push still travels fast
  because the events keep coming.

- **The wheel carries on from where the pane is, not from where the cursor last put it.** The two
  were counted differently — one in rows of the file, one in rows drawn — so the first notch after
  a comment scrolled past jumped the pane somewhere else entirely before scrolling at all.

- **The diff answers the mouse over its text as well as over its numbers.** A drag that began on
  the code and ended there reached nothing, so the copy that should have followed it never ran.

- **A box that takes typing is the terminal library's, not this one's.** The compose box, the report
  box and the filter above the palette and the sheet of keys are all opentui's text box, so a caret,
  a selection, undo, word and line movement and paste come from one place and behave the same in
  each. What is typed there is mirrored back into the review's own state, which is what a comment,
  a report and a filter are made of.

- **The compose box is a text box the terminal library already has.** A hand-written one carried a
  caret spliced into the draft as a character, a wrap that collapsed spaces, and a movement key for
  each thing a reader expects — each of them a thing to get wrong, and several were. It is
  opentui's textarea now: the caret is the terminal's own, and undo, selection, word and line
  movement come with it rather than being written again here.

- **The arrows walk the box the way they walk any other.** Up and down move a line at a time through
  the wrap, not through a list somewhere else. `option` with left or right moves a word, `cmd` moves
  to the ends of the line, and `cmd` with up or down moves to the ends of the draft, which is what
  the same keys do in every box on a Mac. The keys the box does not carry by default are added to
  it, rather than handled beside it.

- **What is pasted is cleaned wherever it came from.** The box takes the paste, and anything a
  terminal can smuggle in is taken back out of what it holds, rather than trusted at the door.

- **A modifier means what the terminal says it means.** Cmd arrives as super and option as option or
  meta, and reading one for the other put the caret at the start of a line where a word was meant.
  Cmd moves to the ends, option and control move by word, and a key held with any of them is never
  typed into the draft. `ctrl+a` and `ctrl+e` reach the ends of a line, as they do in every box on a
  Mac.

- **`shift` with an arrow grows the selection from the cursor.** Selecting lines to comment on took
  `v` first, which is a thing to know before it is a thing to do. Holding shift is the habit every
  editor teaches, and what it selects is what `c` then comments on. Letting the shift go opens the
  comment on it, where the terminal reports releases: the gesture is one movement, and the reviewer
  who did not mean it presses escape. Where releases are not reported, `c` is the same one keypress
  it always was.

- **Every character on the screen is text that can be selected.** A panel drawn by a list widget
  paints rows the terminal cannot hand back, so a title, a path or a command in one could not be
  copied while everything around it could. The palette, the sheet of keys and the search results are
  drawn the way the file list and the review panel already are — text with the current row washed —
  and what is dragged over anywhere is copied when the drag ends.

- **A selection clears on the next key.** It is a thing the reader made with the mouse, and leaving
  it painted over text that has since moved is a mess that outlives its purpose.

- **The row the cursor is on is washed, not dotted.** A file in the list and a thread in the panel
  were marked with a character a reader had to hunt for. A background reads at a glance, which is
  what a cursor is for. The file list also draws the bar the diff draws, at the edge of the row
  rather than inside it, so the two marks carry two facts: the bar says which row the cursor is on,
  and how brightly the wash is lit says whether that pane has the keys.

- **One glyph, one idea.** Five characters carried twelve meanings between them: `▎` was a cursor
  in three panes and a marker on the landing screen, `✓` meant both settled and merely sent, `○`
  and `•` drew the same fact in two shapes, and `·` was a bullet in one pane and a separator in the
  next. Now `▎` is the cursor row and nothing else, `▾` and `▸` are disclosure and nothing else,
  `✓` means nothing is left to do, `→` means sent, `·` only separates, and `⋯` only stands for
  hidden lines. A thread is one ring in three states wherever it is drawn: `○` sent and waiting on
  the agent, `◐` answered but not settled, `●` waiting on you. The file list's badge counts the
  threads still open, so it never promises work that is already settled.

- **The file list draws no icons.** Every file carried the same glyph whatever its extension, and
  every folder another, so two columns of every row said nothing and needed a Nerd Font to draw
  them. The columns go to the path instead.

- **The arrows walk between files.** `[` and `]` do it, and reaching for them is a detour on a
  keyboard where the arrows sit under the hand. Both work everywhere on the review.

- **A drag inside one line copies the characters it covered.** Selecting part of a line is what a
  reader does to take a name out of the diff, and copying the whole line instead is not the same
  thing. The covered characters are washed while the drag holds, and what lands on the clipboard is
  exactly what was washed.

- **The wheel over the diff belongs to the review, not to the pane underneath.** The text pane
  scrolls itself when it is handed a wheel event, which moved what was drawn without the review
  knowing, so the next keystroke put the view back where the review still believed it was. The
  review takes the event and stops it there, and what is drawn and what is believed stay one thing.

- **The scope pinned above the diff can be turned off, and stays off.** It costs rows on a short
  terminal and moves the diff whenever the scope changes, which is not what everyone wants while
  reading. `S` toggles it and the choice is kept with the other settings.

- **Nothing typed into a panel moves the diff behind it.** The panel grows as it is written into,
  which resized the diff, which changed the pinned scope, which resized it again. While a screen is
  for typing, the diff behind it holds the rows it had.

- **Dragging over lines copies them when the drag ends.** Selecting text in a terminal that draws
  its own panes gives the reader nothing, and the habit is older than any key this review offers.
  The rows stay selected afterwards, so the drag can be followed by a comment on the same lines.

- **The footer names the keys of the pane in focus.** One row for the whole screen offered `]` for
  the next file while the reader was standing in the list of comments, and buried the keys that pane
  does answer to. Each pane names its own: the file list carries what folds and marks files, the
  diff what selects and comments, the review panel what settles, removes and reorders. The few that
  work anywhere — the panel, the pull request, the sheet, the way out — stay on every one.

- **The sheet of keys is filtered by typing, and grouped narrowly.** Sixty rows under four headings
  as broad as "General" is a list to read rather than a list to look something up in. Typing filters
  it the way the palette filters, and the headings name the thing being done — moving, files,
  comments, selecting, reading, branches, search — so scanning one is worth doing.

- **`y` copies what the cursor is on when nothing is selected.** Taking a line out of the review to
  paste it somewhere else is the common case, and starting a selection to copy a single line is
  ceremony. On an answer it copies the answer, which is the other thing worth taking whole. On a
  Mac the text is handed to the pasteboard as well as offered to the terminal, because a terminal
  that ignores the escape leaves the reader with nothing and no way to tell.

- **`f` on the review panel hides the threads already settled.** A long pass leaves a column of
  closed conversations above the ones still open, and folding each in the diff does nothing to the
  list. The same key means the same thing in both panes — put away what is done here — and which
  pane is in focus decides what "done" refers to.

- **A review opened on one branch waits for that branch, not for the rest.** Reading every worktree
  before drawing anything makes the wait the sum of what the machine holds, when the reviewer asked
  for one of them. The named one is read first and drawn, and the others arrive behind it, in time
  for the list they belong to.

- **A single hidden line is shown rather than hidden.** The row that stands in for what is folded
  away costs a line of the screen and a keystroke to open, so hiding one line behind it saves
  nothing and asks for something — and when the line was blank, it hid nothing at all. A gap of one
  is opened as the file is read.

- **What was found can be narrowed, and shows the part that differs.** Every match of a name used
  across one directory drew the same long path over and over, cut at the right edge — so the rows
  differed only where the reader could not see, and the line the match was on was the first thing
  lost. The path keeps its end, where the file name is, and the matching line gets the rest of the
  room. Typing narrows the list, and the count says how many of how many are left, because a
  thousand matches is a list nobody reads.

- **Looking for something asks what to look for, and looks while it is being told.** It guessed:
  the longest name on the selected line, which is right often enough to be trusted and wrong often
  enough to mislead — asking for `ActionsMenu` and being shown every use of `ActionsMenuProps`. It
  opens with a box, empty unless the mouse picked something, and the places appear as the words
  are typed rather than when a key says to go. Nothing is read from the clipboard: what a reviewer
  copied is theirs, and a review that pastes it into a box unasked has helped itself.

- **`e` opens the line under the cursor in the reviewer's editor.** Reading a diff is where a
  reviewer decides to change something, and the file and line they want are already under the cursor.
  The file is passed absolute, so it opens whichever worktree the branch lives in.

- **The editor is found, and chosen in the terminal when it is not.** `$VISUAL`, then `$EDITOR`, then
  whatever launched adiff — VS Code, Cursor, Windsurf, Zed and JetBrains all say so in the
  environment. A known editor is given its own line flag, so `code` becomes
  `code repo --goto file:line` and `vim` becomes `vim +line file`.

- **A line is opened inside its project, not on its own.** Handing an editor one absolute path
  opened the file and nothing else: no project, so no imports resolved, no definitions, no
  completion — the reviewer got a text editor where they wanted their editor. An editor that takes a
  folder is handed the branch's worktree as well as the file, which is what `{repo}` in a template
  fills, and every editor is started in that worktree, so the ones that read their project from the
  working directory find it too. A command of the reviewer's own is left as it is written: their
  template, their arguments, and `{repo}` there if they want it.

- **A reviewer with no editor found is offered the ones on their machine, not a file to edit.**
  Pressing the key with nothing to open in opens the editors found on the path, narrowed by typing,
  and choosing one opens the line straight away — the reviewer asked to read a line, not to
  configure a tool. Changing the editor afterwards is a once-a-machine act, so it lives in the
  palette rather than on a letter of its own — the list says which editor is in use, and one key
  hands the choice back to the environment. The settings file is where the choice is kept, never how it is made: a
  reviewer told to edit a file to make a key work has been given a chore instead of an editor.

- **Every message under a line says who said it, and they read down in the order they were said.**
  A thread drew the reviewer's own words with no mark at all, so they read as a continuation of the
  heading above them, while the agent's answer had an arrow and somebody else's remark had a handle —
  one voice of three was anonymous, and it was the reviewer's. Their words carry the reply mark now.
  Two threads on one line also ran together with nothing between them, and the newer was drawn first
  because that is the order the store keeps them in; a line's threads are ordered by when they were
  sent, oldest first, with a rule between them.

- **A thread's stand is drawn as one circle, and every one of them is the same circle.** The four
  stands a thread passes through — filed, waiting, answered, asked — were drawn `○ ◔ ◐ ●`, and a
  terminal draws a quarter-filled and a half-filled circle at sizes of their own, often out of a
  font of their own: whichever of them is on the screen is visibly larger than the plain and the
  filled circle beside it, so two threads at two points in one life read as two kinds of thing and
  the size reads as importance. Only the concentric circles are drawn to one size, so a stand is one
  of those: `○` written, `◎` picked up, `●` answered, and `◉` waiting on the reviewer, which carries
  the ring because it is the thread to go to.

- **The sheet of keys says what the marks mean, under the keys.** The screen is full of marks a
  reviewer was never told: a circle beside a thread, a diamond beside a remark, an arrow before an
  answer. Every one of them was learned by guessing, and a mark you have guessed wrong is worse than
  one you have not read. `?` already answers "what can I press here", so it answers "what am I
  looking at" on the same sheet: a row along its foot naming each thread mark, the remark mark, and
  the two voices. It is drawn from the marks in use, so a sheet cannot say one thing while the panel
  draws another.

- **A search asks git to search, and nothing else.** Every search resolved the branch and read its
  whole diff again to learn which files it changes, so a search of a hundred and thirty-one files
  cost two hundred milliseconds before a single line had been looked at — and it cost that again
  for every word typed. The review already holds what the branch changes.

- **A search hides nothing.** The place the cursor was standing on was left out of what was found,
  a habit from when a search meant "find this selection somewhere else". Typing a name and being
  shown one of its two uses, with the one under the cursor missing, reads as a search that does not
  work. Every place is a place.

- **A name is found however it was capitalised.** A reviewer looking for `useProcessFold` and
  typing `useprocessfold` means the same thing, and a search that answers "nothing" to the second
  is answering a question about typing rather than about the code.

- **What is found is ordered by how near it is to the reader.** The file on screen first, then the
  files the branch changes, then the rest of the worktree. A reviewer searching a monorepo for a
  common name was handed twenty-three thousand places in the order git happened to print them, and
  the one they were reading was somewhere in the middle of it.

- **At the same distance, a place that declares the name comes before a place that uses it.** "Where
  is this defined" is the question a reviewer asks first, and reading it off a list means finding one
  row among hundreds. A row that declares the name is marked as the declaration. A declaration does
  not jump the queue from further away: a name common enough to be declared in twenty packages would
  bury the file the reviewer is reading under declarations of things they never asked about.

- **Tests come after code, and prose, config and data come last.** Snapshots, fixtures, lockfiles,
  documents, workflow files and captured text are where a name appears most and matters least, and a
  sentence in a document is not a declaration however it is worded. Nothing is hidden for being one
  of these; it is last.

- **A search says how many places it did not show.** The count for each of the three distances is
  said, whatever was searched, so a reviewer who is shown ten places in their file still knows the
  name appears in twelve hundred elsewhere. What the cap left out is said in the list rather than
  quietly dropped.

- **A search reads the lines around one place, not around all of them.** Asking git for the
  neighbours of every match meant a common name in a monorepo returned megabytes to be parsed into
  a hundred thousand rows, and each of them was then scanned once per match. Only the place the
  cursor is on is worth showing lines around, so only that one is read.

- **A match is a place in a file, not a line of text.** Every match drew one row that began with
  the same long path, cut where the reader could not see, so a list of twenty said one thing twenty
  times. A file is named once and its matches sit under it by line number, and the one under the
  cursor opens to show the lines around it.

- **Finding the selection elsewhere looks for what was selected.** A reviewer who picks part of a
  line has said exactly what they mean, and the search took the longest name on that line instead —
  so picking a short name looked for a longer one nearby and found the wrong places. Picking
  nothing still means the line's longest name, which is the only guess worth making.

- **The pane the keys reach is said by how brightly its row is lit.** Every pane keeps a cursor, so
  three rows are marked at once and only one of them answers to the keys. That was said with a
  glyph in front of the row — a triangle when the pane was focused and a dot when it was not —
  beside a row already lit to say the cursor was there. Two marks for one fact, and the smaller one
  carrying the part that mattered. The lit row is brighter in the focused pane and dimmer in the
  others, and the glyph is gone.

- **Putting the cursor somewhere with the mouse is not the start of a selection.** Pressing the
  button was read as a drag that had not moved yet, so a click left a line selected, and the arrows
  after it grew that selection instead of moving. A press that goes down and up in one place puts
  the cursor there; a press that moves selects what it moved over.

- **A key means what it prints, not the key it sits on.** A terminal reporting keys in full says
  which key was pressed and which modifiers were held, and for a key whose face carries two
  characters it says the lower one: `?` arrives as `/` with shift. So `?` opened the search rather
  than the key sheet, and the same held for every binding that is a shifted character. What was
  pressed is what the key would print.

- **Ctrl+C asks before it leaves.** With nothing open over the review it left at once, and a review
  is a place a person is working: comments not yet written, a file half read, a place in a hundred
  and thirty-one of them. The key that everything else in a terminal uses to stop the current thing
  should not be the key that throws that away without a word. It says what a second press will do,
  and forgets it the moment any other key is pressed.

- **Ctrl+C closes what is open over the review before it closes the review.** It killed adiff
  outright, so a reviewer who reached for the usual way out of a box they were typing in lost the
  session and everything they had not sent. It dismisses whatever is over the review — the box, the
  key sheet, the palette, the search — and only leaves when there is nothing left to dismiss, which
  is what pressing it twice does.

- **The code comes before the pull request.** Opening a review asked the forge which branches have
  a pull request before it read the branch, and the work a review does runs one thing at a time, so
  a reviewer waited on a network call to see their own diff — over a second here, and as long as
  the forge is allowed to take on a slow line. Which branches have a pull request is worth knowing
  and worth nobody waiting for.

- **Opening the lines a diff is hiding reads the file being opened.** The rows behind a gap come
  from a second reading at whole-file context, and that reading was taken of every file on the
  branch to fill one gap in one of them. Only the file on the screen is ever asked for, and each
  file is read once and kept.

- **Turning past the last file says so.** `]` on the last file and `[` on the first did nothing at
  all, which is the same thing the review does when a key is not bound, or not delivered, or the
  process is wedged. A reviewer cannot tell those apart by looking. It says which end it is.

- **The keys a terminal sends without being taught also move the review.** Paging and jumping were
  bound to `ctrl+d`, `ctrl+u`, `g` and `G`, which are the right keys for anyone who already knows
  them and no keys at all for anyone who does not. Page Up, Page Down, Home and End arrive from
  every terminal and every keyboard, and pressing one and getting nothing reads as the review being
  stuck. They do the same as the letters beside them.

- **The count in the header counts the order the reviewer moves in.** It counted the file's place
  in the diff git handed over, while `[` and `]` walk the tree, so on a branch whose folders do not
  match git's ordering the number jumped — 127, then 1, then 131 — and said nothing about how far
  through the branch anyone was. It counts what can be walked to, so the next press is the next
  number.

- **A branch named on the command line opens where the branch opens.** Naming a branch stood in for
  a remembered place, and a remembered place carries a file: the first one in the diff, which on a
  branch with folders is somewhere in the middle of the tree. The reviewer began 126 files along
  with no sign of it. Naming a branch says which branch, not which file.

- **A thread is drawn again when what it says changes.** The diff is redrawn only when its plan
  changes, and a thread was described to that check by where it sits and the words the reviewer
  opened it with — so an answer or a reply arriving left the screen exactly as it was. Writing into
  a thread and watching nothing happen reads as the writing having failed. What a thread says is
  part of what it is.

- **A thread the reviewer wrote back to is with the agent, not answered.** It carries an answer, so
  counting answers put it under `Answered` and titled it so, while the person waiting was the
  agent. What the thread is waiting on is who spoke last.

- **A branch is resolved and diffed once for each time it is opened.** What the review wants to
  know about a branch — its diff, what has been marked read, its layers, the comments already
  sent — was each asking git for the same worktree and the same diff over again. They are asked
  once and the answer is shared.

- **What a branch is made of is read at once.** Its diff, what has been marked read, its layers and
  the comments already sent do not depend on each other, and reading them one after another was
  most of the wait on a branch of a hundred files.

- **Coming back to a place that is no longer a place to work lands beside it.** A review reopened
  from a session, or opened on a branch named on the command line, was put back on the row it was
  left on, which may be a row standing for lines it hides — and the first key pressed there is
  answered with nothing to comment on. A row that cannot be worked with is replaced by the nearest
  one that can.

- **A file opens on a line, not on the row that stands for the ones it hides.** A change deep in a
  file draws a row saying how many lines are folded above it, and the cursor landed there, so the
  first key a reviewer presses on a file could be answered with "no line here to comment on". It
  lands on the first row that is a line, and `g` goes to that same row.

- **Walking between files is not stopped by a folder being shut.** A folder of more than a handful
  of files starts closed, and the walk between files followed the rows the tree drew — which, in a
  branch whose files all sit in one folder, is none of them. It follows every file the branch
  changed, and opens the folder the file it lands on sits in.

- **`f` hides the files already read, and the one under the cursor stays.** A branch of forty files
  is mostly done files by the end of a pass, and the rows they hold are the rows the diff wants. The
  file being read is never hidden, whatever its state: marking the file you are standing on should
  not pull it out from under you. Nothing is lost — `f` again brings them back — which is why this
  is a filter rather than a second list of read files, since a tree with two orderings in it is
  harder to scan than one that is shorter.
- **The review panel reads newest first, and `O` turns it around.** A reviewer looks at the panel to
  see what just happened, and what just happened was at the bottom.

- **The footer carries the keys a reviewer reaches for, and `?` carries the rest.** A screen answers
  to more keys than fit on one row, so the footer names the few that a pass through a review is made
  of and leaves the others to the sheet. Chips give way from the left when the row is crowded, so
  they are ordered by how much a reader would miss them, with the rightmost surviving longest.
- **The footer names the key that copies once a selection is under way.** The terminal owns the
  mouse while a review is open, so a drag selects lines in adiff rather than making a selection the
  terminal itself could copy, and the reviewer's usual copy shortcut has nothing to act on. The key
  that does work was there all along and named nowhere a reviewer would look.

- **`?` lists every key the current screen answers to**, including the ones the palette hides, since
  a glossary that omits how to leave is not a glossary. Rows are ordered by category so the list can
  be scanned, each names its key, and `enter` runs the highlighted one. The wheel moves it: a panel a
  reader is looking at is the one their scrolling should reach, not the diff behind it. `?` is unbound where typing
  is what the screen is for, so a question mark in a comment stays a question mark.
- **Every row that names a command names its key.** The palette and the sheet render the same row,
  so a command found by typing and a command found by scanning teach the same thing.

- **The compose panel has one way out: the comment goes.** It used to have two, one that sent and
  one that held the comment back for a review sent later, and the second was never the one reached
  for. A point written while reading is a point worth making now, and the screen that listed what
  was held back, the keys that reworded and withdrew from it, and the count in the footer all go
  with it.
- **Withdrawing a comment that has gone is one deliberate keystroke and no confirmation.** `X` takes a shift, so it is not
  reached by accident while scanning the list, and a prompt for every withdrawal would cost more
  than retyping the occasional comment. The notice names what went.
- **`w` wraps the diff, so a long line is readable to its end.** Wrapped or not, a line keeps one
  line number and one cursor mark: the continuations carry neither, so the reader can still tell
  which line they are on and how many lines a selection covers. Comments, prose, gaps and the
  pinned scope keep their places, and a comment written on a wrapped line anchors to the line
  itself. Wrapping breaks at the width the reader can see, so a wrapped line reads whole: no
  character sits in a column the pane never draws. The choice is remembered, so a reader who
  wraps once opens every later review wrapped, in any repository.
- **`>` and `<` pan the diff sideways**, so a line wider than the pane can be read to its end
  without wrapping it. Shift with the wheel does the same. Line numbers, the diff sign and the
  cursor mark stay where they are while the code moves, and the pinned scope moves with the code it
  mirrors. Panning reaches as far as the widest line on the screen, counting the pinned scope as
  well as the body, so a long signature held above a file of short lines can still be read to its
  end. The header counts the columns the reader has moved and stops at the last one that reveals
  anything, so a line that stops short reads as panned rather than as ended. Wrapping and panning
  answer the same question, so panning while wrapped says so and does nothing.
- **What is not code holds its columns while the code pans.** A comment, an answer, a layer's prose
  and a row counting hidden lines are all written for the reader rather than read from the file, so
  they stay where they are. Panning to read the end of a line does not cost the reader the comment
  they were reading, nor the row telling them how to open a gap.
- **`y` copies the selected lines.** What lands on the clipboard is the code as the file holds it:
  no line numbers, no diff signs, no decoration. A reviewer pastes it into an editor, a terminal or
  a message and it runs; anything added would have to be taken out again by hand, while a reviewer
  who wants the file and line has both on the screen in front of them.
- **`/` finds the selection elsewhere in the branch's worktree.** A reviewer selects the line that
  declares something and asks who else uses it, so the answer covers the whole worktree rather than
  only the files this branch changes: the caller worth reading is often code the branch never
  touched. Matches in changed files come first and carry the comment mark, so what belongs to this
  review reads apart from what surrounds it.
- **A line is searched by the longest name on it.** Selection is line-based and a whole line matches
  almost nothing, so the search takes the longest identifier the line holds, skipping language
  keywords, and matches it on word boundaries. The panel titles itself with the term, so what was
  searched is never a guess. A selection of several lines is searched by its first line.
- **The match under the cursor shows the lines around it**, so a reference can be read without
  leaving the list. `enter` opens the file when the branch changes it; when it does not, there is no
  diff to open and the panel says so rather than moving the reader somewhere they cannot read.
- **The line the reviewer is standing on is not a match.** They can see it already.
- **The file list takes a few more columns only where they are spare.** A wide terminal has room
  for a longer name without costing the diff or the review panel the room they need; a narrow one
  does not, and the panel disappearing to buy a wider list is a bad trade.

- **The tree stops indenting after a few levels.** A path six folders deep spent its width on the
  indent rather than on the names, and a name is what a reader is looking for. The rows still read
  in order, so the nesting is legible without paying for it a column at a time.

- **A name too long for the tree keeps both ends.** Either end can be the part that tells two
  files apart. An extension and a suffix separate `invitations.mutations.ts` from
  `invitation-defaults.utils.ts`, whose beginnings are the same word; a prefix separates
  `reduce-window-batches.ts` from `summarise-window-batches.ts`, whose ends are the same words. A
  name that keeps only one end reads as a different, shorter name, and two files deep in a tree can
  end up drawn identically. So a name that does not fit drops its middle and shows `reduce-…tches.ts`,
  with the `…` saying that something was dropped. A folded directory drops whole segments rather
  than characters, so `apps/console/src/pages` reads as `…/src/pages` and stays a path.
- **The header names the file the cursor is on, in full where it can.** The tree gives a name a
  handful of columns once indentation has taken its share, so the header is where the reader learns
  which file they are reading. It carries the path, and when the path is wider than the row it
  drops the middle segments and keeps the first one and the file's own name, marked with `…`. The
  row never runs past the edge of the terminal, because a path cut by the edge carries no mark and
  reads as a path that ended there.
- **A level of nesting costs one column.** A repository laid out five directories deep spends a
  third of a narrow pane on indentation alone, and the fold marker and icon already show where a row
  sits. The reader gets those columns instead.
- **The footer is generated from the bindings**, never written by hand. A key that exists is
  listed; a key that is listed exists.
- **The cursor is always on a row**, and the view follows it. Scroll position is derived from the
  row-to-line map, not predicted from row heights.
- **A selection started with `v` extends from where it started to wherever the cursor is.**
  Composing without a selection anchors to the cursor's single row.
- **The command palette opens wherever a reader is moving around**, over the diff and over the
  review list. It stays shut where a reader is typing, since a draft is not a place to run a
  command from, and on the branch list, whose three actions are already on screen.
- **A panel is sized from the terminal it opens on.** The command palette, the sheet of every key
  and the search results are measured against the width and the height of the
  screen rather than against one fixed size. On a wide terminal a command keeps its whole title and
  a match keeps its whole line, instead of being cut short beside empty columns; on a tall terminal
  the list runs down to the room the screen has, instead of stopping at a count fixed for a short
  one. A panel never grows past what one eye span can read, and a narrow terminal keeps the sizes
  it has now, because the room being spent there is already the room that exists.
- **The terminal says "branch", never "worktree".** A reviewer picks work by the branch name and
  calls the thing a branch when they talk about it, so the list is headed `BRANCH`, the line above
  it counts `3 branches`, and the keys that reload it and jump to its ends say branch too. The
  `--worktree` option keeps its name: it takes a path on disk, which is what a worktree is.
- **The branch list widens with the terminal too.** The name of a branch is what a reader picks a
  branch by, so a wide screen spends its extra columns on the name rather than on margin, and a
  name is cut only where the screen genuinely cannot hold it. Where it is cut it keeps both ends,
  for the reason a file name does: branches are named in families, and two branches whose names
  begin with the same words read as one row when only the beginning survives.
- **The compose panel is as tall as what is written in it.** `enter` adds a line, and a line wider
  than the panel wraps onto the next one. The panel grows to fit either, at any terminal width, so
  a reviewer can always read back what they have typed.
- **What the panel says is what the agent gets.** A selection that reaches over a row of hidden
  lines names the lines it will comment on, quotes only those lines, and counts only those lines,
  so the reader is never shown a range the comment does not carry.
- **The panel opens only where a comment can land.** A row of hidden lines and a layer's prose
  carry no line of their own, so composing on one reports that there is no line to comment on and
  the reader stays in the diff.
- **Sending an empty draft does nothing.** Sending a selection the diff cannot anchor reports it on
  the screen and keeps the draft.
- **After a send the screen returns to the diff with a notice**, and the selection is cleared. The
  reviewer stays where they were reading.
- **`r` reads the branch again.** The agent commits while the review is open, so the diff, the
  comments, the reviewed files and the layers are all read from disk again on request. The reviewer
  keeps their place: the same file by path, and the same source line by number. A file that the
  branch no longer changes lands the reader on the first file that it does.
- **State transitions are a pure function of state and action.** Everything asynchronous — reading
  a diff, submitting a comment — happens outside it, so no screen can be in a state that no key
  could have produced.

#### The review panel

A **review panel** on the right of the diff, holding every comment on the branch in the state it
is in: `Staged`, `With the agent`, `Answered`.

- **A review is a thing a reviewer holds in their head, and the panel is where it lives instead.**
  Staged comments were reachable only through a modal that covers the diff, comments already handed
  over were drawn nowhere at all, and answers were readable only by finding the line they hang off.
  Three states in three places is a review nobody can see the shape of.
- **The panel appears only when the diff can spare the columns.** It takes 34 of them and appears
  when the diff would still hold 56 after the file list has taken its share — enough for a line of
  code and its numbers. Below that the diff wins, because a review tool that cannot show the code
  has nothing to hold a review about. `a` hides it and shows it again where there is room, and says
  so where there is not.
- **A row names where the comment is and what it says.** The path and line, then the first line the
  reviewer wrote, so a comment is recognised by its own words rather than by an id.
- **`z` gives the diff the whole window.** It cleared the file list and left the review panel
  standing, which is half a zoom: a reader who wants the code to have the screen wants both rails
  gone, not one. Pressing it again brings back what was there, so a panel the reader had already
  shut with `a` stays shut.
- **The panel is a third place to stand.** `tab` reaches it after the file list, `j` and `k` walk
  it, and `enter` lands the diff cursor on the comment under the cursor, opening its file if the
  comment is elsewhere. The cursor stays in the panel, so walking a review is one key per comment
  rather than two.
- **An answer that has not been pulled is marked where it is listed**, and the panel says how many
  and which key pulls them. See [PRD 004](004-comment-delivery.md).

#### Writing

- **The caret is somewhere, not always at the end.** `left` and `right` move it a character,
  `alt` with either moves it a word, `home` and `end` reach the ends of the line it is on, and
  typing, `backspace` and `delete` all act where it stands. A draft that can only be appended to
  and truncated from the end makes fixing a word near the beginning cost the whole rest of the
  sentence, which is enough to stop a reviewer correcting one.
- **A paste lands at the caret in one move.** The terminal brackets a paste rather than replaying
  it as keystrokes, so text arriving that way used to be dropped on the floor and a reviewer
  quoting a log or an error message had to retype it. The whole paste is inserted where the caret
  stands, and the caret follows it to the end. Line breaks survive in a draft and become spaces in
  the palette, whose query is one line. Tabs become two spaces, since a raw tab has no width in a
  cell grid and pasted code would lose its shape. Everything else a terminal can smuggle in —
  escape sequences, control characters — is stripped, because a comment is prose that an agent
  reads back, not a channel to the screen.
- **Rewording opens on the end of what was written**, since the reason to reopen a comment is
  usually to add to it.
- **`option` and `command` with backspace take back a word and a line.** A draft is prose, and
  prose is corrected a word at a time; taking one character back at a time for a mistyped word is
  the cost the caret rules exist to remove.
- **The diff is coloured from the file, not from the diff.** Handing the visible rows to the parser
  hands it a fragment: a hunk that starts inside a JSX block or an object literal has no opening for
  the parser to find, and the gap rows and comment rows between hunks are not code at all. The whole
  file is parsed on each side, and the colours for each line are laid onto the rows that show it, so
  what a line is coloured does not depend on where the hunk around it happens to start.
- **The pinned scope is cleared when the file under it changes**, rather than being left to whatever
  the previous file pinned. The memo that skips redrawing an unchanged pin was being reset without
  the pin itself being cleared, so an unchanged-and-empty chain skipped the redraw and the old
  file’s scope stayed on the screen.
- **The rows a reviewer can scroll through do not depend on the pinned scope.** The pin grows and
  shrinks with the nesting under the cursor, and letting the viewport shrink with it made scrolling
  a deeply indented file jump: the viewport changed the scroll, the scroll changed the pin, and the
  pin changed the viewport again. A fixed allowance is reserved for it instead.

- **The caret is drawn where it is**, so what the next keystroke will do is on the screen rather
  than inferred.

- **`}` and `{` land on the change, not on the context above it.** A hunk begins with its leading
  context, so jumping to the hunk left the cursor three lines short of the thing it was jumping to.
  The key is called next change, and that is where it goes.
- **`}` and `{` say when there is no change that way.** A key that lands nowhere and reports nothing
  reads as a broken key rather than as an edge, so the jump names the edge it hit. Widening the
  context ladder merges neighbouring hunks into one, which is what makes this worth saying: `+`
  quietly buys surrounding lines with the changes a reader was stepping between, and a file read
  whole is a single change with nowhere to jump. When only one change is left, the notice names the
  ladder as the reason rather than leaving the reader to guess.

- **`F` shows the whole file, and `F` again gives the diff back.** The context ladder reaches whole
  file already, but only by pressing `=` until it stops, and the way back is as many presses of `-`.
  A reader who opens a file to see what surrounds one hunk wants both moves to cost one key, so the
  toggle remembers the width they had chosen and returns them to it rather than to the default.

- **The list spends a row on `… N more` only when that row buys something.** It reserved one either
  way, which paid for the pane's own padding and left the count itself to be clipped: the list
  simply ended, with no sign that it had. The budget names the two costs separately now, so the
  count is drawn when rows are held back and every row is drawn when they are not.
- **`… N more` counts what is below it, not everything undrawn.** The row sits under the list, so it
  promises more list in the direction it points. Counting every row outside the window made it count
  upward too: a reader scrolled to the last file was told seventeen more were coming and could find
  none of them. At the end of the list the count reaches zero, the row goes, and the list takes the
  row back.
- **`h` closes the folder the cursor's file sits in, then the one above it.** A reader whose tree
  runs past the pane wants fewer rows, and the folder they are standing in is rarely the one worth
  closing. Pressing it again walks outward to the next folder the tree draws, and `l` opens the
  outermost closed one first, so the way back in retraces the way out. Only folders on the path to
  the current file are reachable this way; a folder elsewhere in the tree needs a cursor that can
  stand on it, which the tree does not have.

#### Gaps

A **gap** is a run of file lines the diff leaves out: above the first hunk, between two hunks, or
below the last one. Every gap the file still has shows as one row of the diff that says how many
lines it is holding back.

- **`l` opens the gap the cursor is on and `h` closes it again**, ten lines at a time. Away from a
  gap row the same two keys still open and close the folder or the layers layer, so one key means
  "open what the cursor is on" everywhere on this screen.
- **Opening one gap leaves every other gap where it was.** The whole-file context keys `=` and `-`
  stay as they are, and setting a new context width starts the gaps over.
- **Ten lines is one press**, matching the second rung of the context ladder, so a press of `l`
  buys about what a press of `=` used to buy, in one place instead of the whole file.
- **The cursor stops on a gap row**, because the row is the control. It carries no line number and
  cannot be commented on; a selection that crosses it quotes only the code around it.
- **The row stays under the cursor while the gap empties**, so `l` can be held down. Above and
  between hunks the lines nearest the following change come back first and pile up below the row;
  below the last hunk they come back downward and the row rides beneath them.
- **A gap that runs out stops being a row.** Once no lines are held back anywhere in the file, the
  header stops counting them too.
- **Opened lines are ordinary rows.** They come from git rather than from the file on disk, so they
  carry the same line numbers, are selectable, and a comment on one reaches the agent anchored to
  the file line it names.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| The full enclosing scope chain, rather than one line of git's `@@` context | Reviewing a deeply nested change and needing more than the innermost scope. Attempted and reverted: rendering more than one pinned line as an absolute overlay stops the frame settling, and the chain is only correct when read from the file rather than the diff, because a diff does not contain the lines above its first hunk |
| A file tree, and commenting from it | A branch wide enough that a flat file list stops being navigable |
| Mouse drag selection | Keyboard selection proving slower for wide ranges |
| Vouching from the terminal | Reviewers vouching from the command line and finding it absurd |
| Opening a gap by clicking its row | Reviewers reaching for the mouse on a gap row and finding nothing happens |
| Opening a gap downward as well as upward | A reviewer wanting the lines that follow a hunk more often than the lines that precede the next one |

## Testing Decisions

Observed at the terminal boundary via `driver.screen`, which drives the real terminal with real
keystrokes and captures the rendered frame. Assertions are on the frame's content or on what
reached the store — never on the state object behind it.

Behaviors that must be covered:

- adiff opens on the branches that have something to review.
- Opening a branch shows its file and the changed lines.
- A comment written entirely through keystrokes reaches the agent with the right anchor.
- A comment on more than one line, and a comment on one line too wide for the panel, are both fully
  readable in the panel, with the actions still below them, at more than one terminal width.
- Opening one gap brings back the lines next to it and leaves the other gaps counting the same
  number they counted before.
- A gap opened often enough runs out and its row goes.
- A comment written on a line that only exists because a gap was opened reaches the agent against
  the right file and the right line numbers.
- Two files deep in a nested tree, whose names share their ends, are drawn as two different rows,
  and the header names the file the cursor is on without running past the edge.
- A long command title is read whole on a wide terminal, the sheet of keys lists more of them on a
  tall one, and a long branch name is read whole on a wide one, while an eighty column terminal
  still draws each of them inside its width.
- Two branches whose names begin with the same words are two different rows on a terminal too
  narrow to hold either name whole.

A frame assertion must name something construction guarantees. "The widest span is the diff" is a
test that fails when an unrelated pane grows, which is a false report, not a caught bug.

### A branch that already has a pull request says so

The branch list reads whether a branch has a pull request and shows its state beside what is
waiting: open, draft, merged or closed. A merged pull request means the review happened elsewhere,
a draft means the work is not ready for a reviewer. The review screen says the same word in its
header, so a reviewer inside a diff knows the branch has one without going back to the list.

- **The list draws before the answer arrives.** The state is fetched once for the whole list, after
  the screen is on, and fills in when it lands. Nothing waits on the network.
- **`p` opens the pull request from both screens the reviewer reads on**, the branch list and the
  review, in a browser. It is one of the keys the footer names on each, because a key that has to
  be searched for in the palette before it is known is a key a reviewer does not have.
- **The footer names the key where there is a pull request to open.** A branch the forge answered
  for with nothing, and a forge that answered nothing at all, both leave the row without `p`, so it
  never advertises a keystroke that can only refuse. The key stays bound and stays in the sheet
  under `?`, so a reviewer who knows it can still press it and be told what happened.
- **What adiff cannot tell, it says.** No `gh`, not signed in, offline, or a remote that is not
  GitHub is a different fact from a branch that has no pull request, and an empty column reads as
  the second one. The branch list says once, under the table, that it could not find out.

## Out of Scope

- Editing code from the terminal.
- Reading a branch that is not a worktree of the repo adiff was pointed at.
- Resizing behavior beyond what the layout engine provides.
- Reading [layers](CONTEXT.md#layers) — see [PRD 006](006-narrative-review.md).

## Further Notes

The terminal is deliberately the thinner half of adiff. Every action it offers is a command that
exists without it, which is what makes the behavior testable at the store rather than only
on-screen, and what keeps a reviewer from being trapped in a UI to do something a script should do.
