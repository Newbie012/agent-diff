# The agent's side of the review

Three commands are the whole loop for the agent working in the branch. The skill installed by
`npx skills add Newbie012/agent-diff --skill adiff -g` teaches it these, so an agent that has the skill
needs nothing from this page. Read it if you are wiring an agent in yourself.

## The three commands

    adiff comment take --worktree . --wait 300
    adiff comment answer --worktree . --id <id> --body "what you did about it"
    adiff review pane --repo <repo> --branch <branch>

`comment take` collects the comments this branch is still owed an answer on. `--wait` blocks until a
comment arrives or that many seconds elapse, and takes a whole number from 1 to 86400. Anything else is
refused on stderr with exit `2`, because an instant empty answer reads exactly like a wait that expired.
An empty `comments` array means the wait ran out with nothing new, which is not a failure.

The skill has the agent run the wait in the background and arm it again after each comment, so a comment
reaches it as an event rather than when somebody thinks to ask.

`comment answer` says what was done, against the id the take reported. `--question` marks the thread as
waiting on the reviewer instead.

`review pane` opens the review beside the conversation, in tmux, Zellij, WezTerm or kitty. Anywhere
else it answers `opened:false` and carries the command to run, so the agent quotes one line rather than
a paragraph. Open a pane when a review was asked for.

## What a comment carries

    adiff comment take --worktree .
    {"ok":true,"comments":[{"id":"1c43cb55","file":"src/api/invitations.ts","side":"new",
     "start":12,"end":13,"head":"63c11ce3",
     "snippet":"  if (res.status === 409) throw new AlreadyInvited(email)\n  ...",
     "body":"Three status checks in a row. One error shape would do."}]}

`snippet` is the exact text the reviewer had selected. `side` says whether the line numbers are on the
new file (`new`) or the version being replaced (`old`). `head` is the commit the diff was read at, so an
agent that has moved past it can say so rather than guessing at code that has already gone.

A reply the reviewer writes arrives through the same take, with an `id` of its own to answer against,
`replyTo` naming the comment it continues, and `thread` carrying what was said before it, oldest first.
A reply is short because it is the rest of a sentence, so read the thread before answering.

## The take rule

A comment comes back on every take until it is retired, and three things retire it: the agent answers
it, the reviewer settles it, or the reviewer removes it. So a take that runs twice hands the same comment
twice, and a crash or a second reader loses nothing.

Two waits on one branch return the same comments, which is two agents answering one comment. Keep one.

## A question back to the reviewer

    adiff comment answer --worktree . --id <id> --question --body "Drop it, or keep it and map the error?"

`--question` moves the thread into the panel's `Waiting on you` section, so the reviewer sees the work
has stopped on their decision. It is for a question the work genuinely waits on, not for checking in.

Settling is the reviewer's. The agent that wrote the answer cannot close the thread.

## Where the skill has to live for an agent in a worktree to find it

`-g` puts the skill in the home directory. Written into the repository instead, the skill is an untracked
file, and an agent working in a worktree of that repository does not see an untracked file in the
checkout beside it. So the skill reaches that agent only once it is committed.

When an agent cannot see the skill, run the install again with `-g`. `npx skills update adiff` brings an
installed skill up to the adiff running beside it; a skill one version behind gets a refused command with
a `suggestion` naming the fix.

## Next

- [Layers](Layers), the reading order an agent publishes when the reviewer asks for one.
- [The commands](The-commands), the JSON contract, the exit codes, and `adiff describe`.
