<div align="center">

# adiff

An agent finishes a piece of work and leaves you a diff. adiff puts the conversation on the code:
you comment on the lines in a terminal, the agent that wrote them answers under your words, and a
point stays open until you settle it.

<pre align="center">brew install Newbie012/tap/adiff</pre>

<p align="center"><a href="docs/install.md">Other ways to install</a></p>

<img src="assets/terminal.webp" alt="The adiff worktree list, showing seven branches with their sizes, layers and review state" width="820">

</div>

## Getting started

Install adiff, then teach the repository what it is:

```bash
brew install Newbie012/tap/adiff
adiff init --write --skill
```

`init` writes a short passage into `AGENTS.md` and a `CLAUDE.md` that imports it, and `--skill`
writes the full skill into `.claude/skills/adiff/`. Then ask your agent to walk you through it:

> Read the adiff skill and onboard me: hand your current work over for review, and tell me what to
> press.

From then on the loop is: the agent hands work over, you read it, and it answers what you wrote.

## Reviewing

```bash
adiff review open --repo .
```

`j` and `k` move down the diff, `[` and `]` between files, `v` starts a selection and `c` writes a
comment that `ctrl+s` sends. `d` settles the thread you are on, `m` marks a file reviewed, `y`
copies the line you are on, and dragging over lines copies them. `?` lists every key and filters as
you type. The footer carries the keys of whichever pane you are in.

`,` opens the preferences and turns any of it on or off. Turn on holding and a comment waits with
the others until `C` sends them to the agent as one review.

## For agents

Three commands are the whole loop:

```bash
adiff comment take --worktree . --wait 300   # what the reviewer wrote, with the code it was on
adiff comment answer --worktree . --id <id> --body "what you did about it"
adiff review pane --repo .                   # put the review in front of them, split in tmux
```

Everything answers JSON on stdout and `{"ok":false,"error":{...}}` on stderr, with a `suggestion`
naming the command that resolves it. `adiff describe` returns the whole catalog, so nothing here has
to be memorised. [The handover in detail](docs/handover.md) covers layers, coverage and the rest.

## Requirements

The commands run on Node 22 or newer. The terminal wants Node 26, which Homebrew brings along; on a
global npm install adiff finds a Node 26 among your fnm, nvm, asdf, volta and Homebrew installs and
runs the terminal on that.

## Notes

adiff is alpha, and one person's tool. Every release goes out under the `alpha` tag. Project docs
live in `.agents/`: `AGENTS.md` covers making a change, `ARCHITECTURE.md` how the code is laid out.

## License

MIT

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/Newbie012">
		<img src="https://cdn.jsdelivr.net/gh/newbie012/sponsors/sponsors.svg">
	</a>
</p>
