# adiff

adiff is a terminal for reviewing the work a coding agent left in a branch, and for handing the
comments back to the agent that wrote the code. It is for one engineer running several agents at
once, and it needs an agent that can run commands in the repository.

<!-- IMAGE-1: The adiff branch list, with each branch's files and its lines added and removed -->

## What changes when an agent wrote the code

You select the lines and write a comment there. The comment is filed against the branch, and it
carries the file, the side of the diff, the line range, the commit the diff was read at, and the exact
snippet you selected. The agent collects it, does the work, and answers that comment by its id. The
answer sits under the comment, and the thread stays open until you settle it.

With `git diff` the location and the reply are both prose, so each side rebuilds the line reference by
hand and neither can tell which comment was addressed.

<!-- IMAGE-2: A thread under the code it was written on, the comment and then the agent's answer, with the review panel beside it listing every thread on the branch -->

## Install

    brew install Newbie012/tap/adiff
    npx skills add Newbie012/agent-diff --skill adiff -g

Two commands. The formula installs one compiled binary, which draws the terminal itself and needs no
Node at all. The second installs the skill that teaches your agent to pick up your comments; it asks
which agent you use, or name it up front with `--agent codex`, more than once for more than one, or
`--agent '*'` for all of them. `-g` puts the skill in your home directory rather
than in the repository you are standing in, which matters because a skill written into the repository
is invisible to an agent working in a worktree of it unless you commit it. Drop `-g` once your team has
adopted adiff and wants it committed. [Other ways to install](Install-adiff).

adiff writes nothing into your repository. The review lives in adiff's own store at `~/.adiff`.

Your agent finds the skill on its own. Then ask it to walk you through the loop:

> Read the adiff skill and onboard me: hand your current work over for review, and tell me what to
> press.

Open a review yourself with `adiff review open --repo .`, and press `?` for every key.

## Read next

- [Your first review](Your-first-review), one branch from the first key to a settled thread.
- [The agent's side of the review](The-agent's-side-of-the-review), the three commands the agent runs.
- [The keys and what carries between sessions](The-keys-and-what-carries-between-sessions).
- [Layers](Layers), the reading order an agent can publish over its own diff.
- [The commands](The-commands), the JSON contract, and the one command that answers in none.

adiff is alpha and one person's tool. Every release goes out under the `alpha` tag.
