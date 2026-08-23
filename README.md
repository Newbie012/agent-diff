<div align="center">

# adiff

An agent finishes a piece of work and leaves you a diff. adiff puts the conversation on the code:
you comment on the lines in a terminal, the agent that wrote them answers under your words, and a
point stays open until you settle it.

<img src="assets/terminal.webp" alt="The adiff worktree list, showing seven branches with their sizes, layers and review state" width="820">

</div>

## Getting started

Two commands. The first installs adiff, the second tells this repository that review happens here:

```bash
brew install Newbie012/tap/adiff
adiff init
```

[Other ways to install](docs/install.md), if you would rather not use Homebrew.

`init` writes a short passage into `AGENTS.md`, a `CLAUDE.md` that imports it, and the adiff skill
into `.claude/skills/adiff/`, so an agent working here picks up your comments without anyone naming
the tool. `adiff init --check` shows what it would write and writes nothing.

Then ask your agent to walk you through it:

> Read the adiff skill and onboard me: hand your current work over for review, and tell me what to
> press.

From then on the loop is: the agent hands work over, you read it, and it answers what you wrote.
Open a review yourself with `adiff review open --repo .`, and press `?` for every key.

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
