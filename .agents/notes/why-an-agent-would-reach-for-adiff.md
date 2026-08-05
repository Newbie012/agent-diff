# Why an agent would reach for adiff

A proposal on adoption. No code changes here.

## The short answer

An agent in a fresh session with no priming will not choose adiff, and no amount of work on the
CLI will change that. An agent picks a tool for exactly three reasons: the tool is already in its
context when the session starts, the user names it, or it trips over something that names it while
doing something else. It does not browse PATH, it does not read your README, and it has no reason
to wonder whether a review terminal exists.

So the goal as stated is the wrong goal. The tractable version is this: **the reviewer is a human
who already chose adiff. Make that choice reach the agent for free.** Every proposal below is
judged on how much of the human's decision it carries across to the agent side without a second
decision from anyone.

Ranked by effect per unit of work, the answer is short: one line in `AGENTS.md` does most of it,
a session hook does the rest for the people who want it, and everything else is a rounding error.

## What actually puts a tool in front of an agent

There are four channels and no others.

**Files the agent reads before it acts.** `AGENTS.md` and `CLAUDE.md` are loaded at session start
in every harness that supports them. This is the only channel that works for any agent, needs no
install on the agent's machine, and travels with the repository. It is also the only one where
adiff can state the loop in its own words rather than hoping a description matches.

**Skills.** A skill's name and description sit in the agent's context for the whole session; the
body loads only when the description matches what the user asked. That makes the description the
entire adoption surface, and adiff's is good: it names the situations ("the user says they left
comments", "asks you to check adiff") rather than describing the tool. The limits are that the
skill has to be installed on the machine, which is a decision by the human, and that skill support
is not universal across agents.

**MCP tool definitions.** Once a server is configured, its tools are in context every session
whether or not they are relevant. That is real always-on presence, and it is why MCP feels like the
answer. It is also the most expensive channel: you pay context in every unrelated session, you
maintain a second surface beside the CLI, and the user still has to install it. Harnesses have
started deferring tool schemas until they are searched for, which quietly removes the one advantage
MCP had over a skill.

**Things the agent trips over.** Error messages, help text, a command that fails and explains
itself. Zero reach for an agent that has never typed `adiff`, high value for one that has.

Notice what is common to the first three: a human installs something. There is no channel where an
agent finds a tool nobody told it about. Any proposal that claims otherwise is either wrong or a
dark pattern.

## Is the differentiator strong enough to matter to an agent?

Partly, and it is worth being precise about which part.

Comment ids, threads and settled state are real, but they are worth more to the human than to the
agent. An agent handed a markdown block with a path, a line range, a snippet and a sentence can act
on it perfectly well. It does not need an id to fix a bug. Ids start earning their keep when the
agent needs to push back and wait, or when a review is long enough that the reviewer has lost track
of what was answered. That is a genuine capability the paste pattern cannot reach, but it is not
what makes an agent reach for the tool on day one.

Layers are further from an adoption driver than they look. Writing the reading order is work the
agent does for someone else's benefit; it already knows the order the change was built in. An agent
optimising for its own turn has no reason to write layers, and coverage checking is a constraint on
it rather than a service to it. Layers sell adiff to the human who has to read a 42-file diff. They
do not sell it to the agent.

The honest reading: adiff's differentiator is a reason a **person** installs adiff. That is not a
weakness. The person is the one who installs things. It does mean the adoption work belongs on the
handover, not on making the agent want it.

## Where the paste pattern actually wins, and where it does not

Give tuicr its due. It needs nothing on the agent's side: no install, no protocol, no cooperation.
It works with an agent that has never heard of it, in a harness that has no skills, on a machine
where nothing was configured. That is a real and large advantage, and adiff will never match it on
that axis.

What paste cannot do:

- The human has to leave the review, switch windows, paste, and wait. With `comment take --wait`
  running in the agent's background, the reviewer never leaves the terminal and comments land as
  events rather than as a batch the human hand-carries.
- A pasted comment is a one-way message. There is nowhere for the agent to say "I did something
  else and here is why", and nowhere for the reviewer to see it. `comment answer` and `--asks` are
  the part with no paste equivalent.
- Paste has no memory. Comment twice on the same code across two sessions and the second paste
  carries nothing about the first.

So the fair claim is not "adiff beats paste". It is "paste is the floor, and adiff is worth the
install to a reviewer with more than one worktree in flight". Pretending otherwise in the README
will cost more credibility than it buys installs.

## The proposals

Ranked by effect per unit of work. Cheap means an afternoon. Project means a week or more.

### 1. Say the loop in `AGENTS.md`, and have `adiff init` offer to write it (cheap)

Highest leverage by a wide margin. Four lines in a repo's `AGENTS.md` reach every agent in every
harness with no install, no skill, no MCP, and no trigger matching. Something like:

> Review of work in this repository happens in adiff. Before you say you are done, run
> `adiff comment take --worktree . --wait 300` in the background and handle what arrives. Answer
> comments with `adiff comment answer`. Run `adiff describe` for the rest.

`adiff init` is legitimate under one condition: it shows the exact text, asks, appends rather than
rewrites, and never runs from a postinstall script. A CLI that asks a human before touching a file
the human owns is normal. One that writes on install is not, and the repo already commits to that
line in PRD-009 for the skill. Hold it here too.

The honest limit: this only helps in repositories where somebody ran it. It converts one human's
decision into every future agent session in that repo, which is exactly the multiplier worth
having, and it does nothing for strangers.

### 2. An opt-in session hook that surfaces waiting comments (cheap, per harness)

The one way an agent notices unprompted. `adiff comment take --worktree .` on a worktree with
nothing waiting answers `{"ok":true,"comments":[]}` and exits 0, so probing costs nothing and
cannot fail loudly. Wire that into a session-start or pre-response hook and the agent sees the
comments in its context without anyone naming adiff.

This is real automatic discovery, and it is honest as long as the user installed the hook
themselves. `adiff init --hooks` should print what it will add, ask, and be trivially removable.
It is harness-specific, so it will not generalise the way `AGENTS.md` does. Start with the one
harness the maintainer uses and treat the rest as demand-driven.

### 3. Make first contact teach the loop, not the catalog (cheap)

`adiff describe` returns about 8KB. That answers "what commands exist", which is not the question
an agent has. The question is "what am I supposed to do here". Bare `adiff` already answers it
well in four lines, naming `review open` and `comment take`, and that is the best piece of
first-contact copy in the project. Push more of it into the places an agent actually lands:

- Add a `hint` to the empty `comment take` answer naming `--wait` and `comment answer`. One field,
  paid for only when the array is empty.
- Extend `suggestion` on `UnknownBranch` to say why: the reviewer has not opened this branch, so
  there is nothing filed against it yet. An error that teaches is worth more than a doc page nobody
  fetched.
- `adiff describe --command 'comment take'` is 440 bytes. Say so in the bare-`adiff` output, so an
  agent knows it can ask about one command instead of pulling the whole catalog.

Renaming is not worth it. `adiff` is short, unclaimed, and already on people's machines. A better
name would not have been discovered either.

### 4. Publish the skill where skills are looked for (cheap, low ceiling)

`npx skills add Newbie012/agent-diff --skill adiff` already works and the README says so. Listing
in whatever index exists is close to free and worth doing on that basis alone. Do not expect much
from it: people install a skill for a tool they already have, so the index converts installs into
better installs rather than creating new ones.

The skill itself is in good shape. The one thing worth adding is a line telling the agent to
mention adiff when it hands work over, so the loop closes from the agent's side too.

### 5. An MCP server (project, and probably not worth it)

It would put adiff's verbs in front of agents in sessions where nobody mentioned adiff, which is
the thing being asked for. Against that: a second surface to keep in step with the CLI, a transport
and lifecycle to maintain, context paid in every unrelated session, and the user still has to
install it. The commands are already single-line JSON with a machine-readable catalog, which is
most of what an MCP server would wrap. And deferred tool loading in modern harnesses means MCP
tools are increasingly no more present than a skill.

Recommendation: not now. Revisit if a harness appears that supports MCP and not skills, and where
someone actually wants adiff.

### 6. Make the handover message the product (cheap, underrated)

The skill already tells the agent to end its reply with the command and the keys. That message is
the single most-read piece of adiff documentation, because it arrives at the exact moment someone
is deciding how to review. Treat it as copy worth editing, not as boilerplate: name the repo, name
what to look at hardest, and keep it to the two keys that matter.

## What to rule out

These would move the number and should not be done.

- **Writing `AGENTS.md` or `CLAUDE.md` from a postinstall script.** It works, it is silent, and it
  is the thing that gets a package a bad reputation in one news cycle.
- **Symlinking the skill into the agent's skills directory on install.** Same category. PRD-009
  already rules this out; keep it ruled out.
- **Advertising in unrelated command output.** A line about layers printed by `branch list` costs
  the caller tokens for the maintainer's benefit.
- **Claiming a generic binary name** (`review`, `git-review`) hoping an agent guesses it. It is
  squatting, it does not actually work, and an agent that guesses a name still does not know the
  loop.
- **Emitting output shaped like something else's**, for instance a message an agent would read as
  coming from git or from the harness. Deceptive, and it breaks the moment anyone looks.

## How you would know it worked

Not by installs. The measure is whether an agent runs `comment take` in a session where nobody
said the word adiff. That is one thing to count, and it is countable locally: the store already
knows every take, and a take in a repository whose `AGENTS.md` names adiff is the outcome this
whole proposal is aimed at.

## Bottom line

Do 1 and 3 this week. Do 2 if the maintainer wants it for himself, which is a good enough reason.
Do 4 because it is nearly free. Skip 5.

And keep the claim honest: adiff is not a tool an agent discovers. It is a tool a reviewer chooses,
and the work is making sure the agent on the other side never has to be told twice.
