# Why an agent would reach for adiff

A proposal on adoption. No code changes here.

## The short answer

An agent in a fresh session with no priming will not choose adiff, and no work on the CLI will
change that. An agent picks a tool for exactly three reasons: it is already in context when the
session starts, the user names it, or it trips over something that names it while doing something
else. Agents do not browse PATH, do not read your README, and have no reason to wonder whether a
review terminal exists.

So the goal as stated is the wrong goal. The tractable version: **the reviewer is a human who
already chose adiff. Make that choice reach every future agent session for free.** The good news
is that this is now a solved problem in the ecosystem, and adiff is one afternoon away from
solving it. The bad news is in the next section.

## The competitor is not the paste pattern

The brief assumes tuicr's play is clipboard export with no agent-side cooperation. That was true
once. Today tuicr ships all three layers:

- **Clipboard.** `y` or `:clip` copies structured markdown, numbered, with file and line anchors.
  "Paste it back to any coding agent (Claude, Codex, Cursor, etc)."
- **A skill**, at `skills/tuicr/SKILL.md`, described as "Use tuicr's review CLI to read and add
  comments in active TUI review sessions, and launch tuicr in tmux, Zellij, or Herdr when a user
  needs an interactive review pane."
- **A JSON CLI for agents.** `tuicr review` lists sessions, adds comments and prints stored
  comments "for agent and script integrations". The skill has the agent poll
  `tuicr review comments --repo <path> --session <slug>` about every 30 seconds and compare comment
  ids to spot new ones.

So the honest competitive picture is not convenience against principle. It is two tools with the
same architecture, where the competitor has 2.4k stars, a one-line curl install, a Homebrew
formula, and support for git, jj and mercurial plus GitHub, GitLab and Bitbucket.

What tuicr does not have, as far as its README and skill show: no answering a comment, no thread
state, no settled or unsettled, no `--asks` to hand a decision back, no exactly-once delivery, no
layers, no coverage check, no `AGENTS.md` story, no MCP.

And it has one thing adiff does not: **the agent opens the review itself**, in a tmux or Zellij
split pane, when the work is done. That inverts the handover. adiff's skill currently ends by
telling the agent to write a paragraph asking the human to go run a command.

## Is the differentiator strong enough to matter to an agent?

Partly, and it is worth being precise about which part.

Threads with answers and settled state are the real thing, and tuicr has no answer to them. But
they are worth more to the human than to the agent. An agent handed a path, a line range, a snippet
and a sentence can act perfectly well; it does not need an id to fix a bug. Ids start earning their
keep when the agent needs to push back and wait, which is what `comment answer --asks` is for, and
when a review runs long enough that the reviewer has lost track of what was addressed. Genuine
capability, not a day-one adoption driver.

Blocking `--wait` is a quieter but sharper advantage. Polling every 30 seconds burns a turn each
time and still adds latency; a backgrounded blocking wait costs nothing until a comment lands.
That is a better loop, and it is cheap to explain.

Layers are further from an adoption driver than they look. Read PRD-006: every user story starts
"as a reviewer". Writing the reading order is work the agent does for someone else, since it
already knows the order it built the change in, and coverage checking is a constraint on the agent
rather than a service to it. Layers sell adiff to the human facing a 42-file diff. They do not sell
it to the agent, and no amount of framing will make an agent want to be audited.

The honest reading: adiff's differentiator is a reason a **person** installs adiff. That is not a
weakness, since people are what install things. It does mean the adoption work belongs on the
handover, not on making the agent want it.

## What actually puts a tool in front of an agent

Four channels, and no others.

**Files the agent reads before it acts.** `AGENTS.md` is now a Linux Foundation format under the
Agentic AI Foundation, with 20-plus compatible agents and 60k-plus repositories using it. It has no
required fields and always applies. This is the only channel that needs nothing installed anywhere
and travels with the repository.

**Skills, and they are no longer a Claude thing.** The open standard at agentskills.io defines
SKILL.md with six frontmatter fields, and the client list runs to roughly forty: Claude Code,
Cursor, Codex, Gemini CLI, Copilot, VS Code, OpenCode, Goose, Junie, Amp and on. Only `name` and
`description` load at startup, about 100 tokens, and the description is the entire matching
surface. adiff's SKILL.md uses exactly `name` and `description`, so it is already spec-clean and
portable with no work.

The part worth sitting up for: **a skill committed into a repository is picked up with no install
step**. Claude Code loads `.claude/skills/` from the launch directory up to the repo root; Cursor
reads `.agents/skills/` and `.cursor/skills/` and keeps legacy compatibility with `.claude/skills/`;
Codex scans `.agents/skills/` from cwd up to the repo root. One directory committed once reaches
every agent every teammate runs, forever, with auto-triggering on description match. That is
strictly more powerful than an `AGENTS.md` line and it costs the same single decision.

**MCP tool definitions.** Configured once, present every session. That used to be the one channel
with genuinely automatic presence. It is much weaker now: harnesses defer tool schemas until
something searches for them, so MCP tools are no more present than a skill description while still
costing a second surface to build, version and keep in step with the CLI. Codex, Cursor and Claude
Code all support MCP, and registries exist, but a registry entry is not discovery; nobody browses
for a tool they do not know they need.

**Things the agent trips over.** Error messages and help text. Zero reach for an agent that never
typed `adiff`, high value for one that just did.

Common to the first three: a human installs something. There is no channel where an agent finds a
tool nobody told it about. Any tactic claiming otherwise is either wrong or a dark pattern.

## The proposals

Ranked by effect per unit of work.

### 1. `adiff init` commits the skill and an AGENTS.md line into the repo being reviewed (cheap, highest leverage)

This is the whole proposal, and everything else is a rounding error next to it.

Write `.claude/skills/adiff/SKILL.md` (widest reach: native for Claude Code, legacy-compatible for
Cursor and Codex) or `.agents/skills/adiff/SKILL.md`, plus four lines in `AGENTS.md` naming the
loop for agents that read instructions but not skills. Commit both. From then on, every agent any
teammate runs in that repository knows the loop, with no per-machine install, no registry, no MCP,
and no one having to say the word adiff.

The `AGENTS.md` text wants to be short:

> Review of work in this repository happens in adiff. Before you say you are done, run
> `adiff comment take --worktree . --wait 300` in the background and handle what arrives. Answer
> with `adiff comment answer`. `adiff describe` lists the rest.

Legitimate under conditions that are not negotiable: it shows the exact text, it asks, it appends
rather than rewrites, and it never runs from a postinstall script. A CLI that asks before touching
files the user owns is normal. PRD-009 already draws that line for the skill symlink. Hold it here.

Two things to get right. Committing a skill directory into someone else's repo is a bigger
imposition than one line of markdown, so `adiff init` should offer them separately and let someone
take the `AGENTS.md` line alone. And the skill should degrade honestly: an agent that reads it on a
machine with no adiff should get a clear "not installed" rather than a confusing failure.

### 2. Let the agent open the review (cheap, and it closes the loop)

tuicr's best idea, and adiff has no equivalent. Today the skill tells the agent to write a
paragraph asking the human to run `adiff review open`. That paragraph is the weakest link in the
handover, because it depends on a human reading, switching context and typing.

Instead: when the agent finishes and a multiplexer is running, it opens `adiff review open --repo
<repo>` in a split pane beside itself. The reviewer's next action is to look right, not to run
something. Combined with a backgrounded `comment take --wait`, the round trip is a human selecting
lines and an agent responding, with nobody switching windows.

This is a skill change plus a small launcher, not a rewrite. It is also the single most visible
difference a person would feel in the first five minutes.

### 3. An opt-in session hook that surfaces waiting comments (cheap, per harness)

The one way an agent notices unprompted. `adiff comment take --worktree .` on a worktree with
nothing waiting answers `{"ok":true,"comments":[]}` and exits 0, so probing is free and cannot fail
loudly. Wire that into a session-start hook and the agent sees comments in context without anyone
naming adiff.

Honest as long as the user installs the hook themselves. `adiff init --hooks` should print what it
adds, ask, and be trivially removable. It is harness-specific and will not generalise the way the
skill does, so build it for the one harness the maintainer uses and let demand drive the rest.

### 4. Make first contact teach the loop, not the catalog (cheap)

`adiff describe` is 7,903 bytes. It answers "what commands exist", which is not the question an
agent has. The question is "what am I supposed to do here". Bare `adiff` already answers it in four
lines, naming `review open` and `comment take`, and that is the best first-contact copy in the
project. Push more of it where agents actually land:

- Add a `hint` to the empty `comment take` answer naming `--wait` and `comment answer`. One field,
  paid for only when the array is empty, and the empty answer is exactly where a confused agent
  ends up.
- Say in the bare-`adiff` output that `describe --command 'comment take'` is 440 bytes, so an agent
  knows it can ask about one command instead of pulling the whole catalog.
- Keep doing what `NoLayers` already does. Its suggestion reads "No layers has been written for
  this worktree. Write one with `adiff layers set`." An error that teaches beats a doc nobody
  fetched, and this one is the model for the rest.

Renaming is not worth it. `adiff` is short, unclaimed and already installed. A better name would
not have been discovered either.

### 5. Keep publishing the skill for per-machine install (nearly free, low ceiling)

`npx skills add Newbie012/agent-diff --skill adiff` already works, and that CLI covers 75-plus
agents, so this is genuinely cross-agent rather than a Claude-only path. Keep it in the README.

Do not expect discovery from it. skills.sh has no submission or review flow: listing and ranking
come from anonymous install telemetry, so you appear there after people already install you. It is
a scoreboard, not a shop window. Publishing converts existing users into better-configured users,
which is worth having and is not a growth channel.

### 6. An MCP server (project, and not now)

It would put adiff's verbs in sessions where nobody mentioned adiff, which is nominally the ask.
Against it: a second surface to keep in step with the CLI, a transport and lifecycle to maintain,
and the user still has to install it. The commands are already one-line JSON with a machine-readable
catalog, which is most of what a server would wrap, and deferred tool loading has removed the
always-present advantage MCP had over a skill.

Revisit if a harness appears that supports MCP and not skills, and where someone actually wants
adiff. That is not the situation today.

## What to rule out

These would move the number and should not be done.

- **Writing `AGENTS.md`, `CLAUDE.md` or a skill directory from a postinstall script.** It works, it
  is silent, and it is the kind of thing a package gets remembered for.
- **Symlinking the skill into the agent's skills path on install.** Same category. PRD-009 already
  rules it out. Keep it ruled out.
- **Advertising in unrelated command output.** A line about layers printed by `branch list` costs
  the caller tokens for the maintainer's benefit.
- **Claiming a generic binary name** (`review`, `git-review`) hoping an agent guesses it. Squatting,
  it does not actually work, and an agent that guesses a name still does not know the loop.
- **Output shaped like something else's**, for instance a message an agent would read as coming from
  git or from its own harness. Deceptive, and it breaks the first time anyone looks.
- **A skill description written to match more than adiff does**, so it triggers on any mention of
  review. It would raise invocations and burn the trust that makes the next skill work.

## How you would know it worked

Not installs. The measure is whether an agent runs `comment take` in a session where nobody said
the word adiff, and that is countable locally: the store already records every take, and a take in
a repository whose committed skill names adiff is exactly the outcome this is aimed at.

## Bottom line

Ship 1 and 2 this week; between them they are the difference between a tool people are told about
and a tool that works by default. Do 4 alongside, it is an hour. Do 3 if the maintainer wants it
for himself, which is reason enough. Skip 6.

And drop the framing that the competition is a clipboard. It is a tool with the same shape, more
stars and an easier install, which already does the agent loop. adiff's answer is that a review is
a conversation the agent can answer into and a reading order the agent has to prove covers the
diff. That is a real difference and it is worth saying plainly, to the person choosing the tool,
because the agent was never the one deciding.
