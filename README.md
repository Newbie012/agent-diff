<div align="center">

# adiff

An agent finishes a piece of work and leaves you a diff. adiff puts the conversation on the code:
you comment on the lines in a terminal, the agent that wrote them answers under your words, and a
point stays open until you settle it.

<pre align="center">brew install Newbie012/tap/adiff</pre>
<pre align="center">npx skills add Newbie012/agent-diff --skill adiff -g</pre>

<p align="center"><a href="docs/install.md">Other ways to install</a></p>

<img src="assets/terminal.webp" alt="The adiff worktree list, showing seven branches with their sizes, layers and review state" width="820">

</div>

### Features

- 💬 **Comment on the lines.** The agent gets your words with the code they were about.
- 🔁 **Nothing gets dropped.** A comment comes back until the agent answers it.
- 🚦 **Every point has a state**: sent, picked up, answered, settled.
- 🧷 **A comment follows its code** when the agent rewrites the file.
- 🌱 **Review a worktree**, before anything is pushed.
- 🪜 **Stacked branches** are diffed against the branch below.
- 🔗 **Read the pull request's review here.** Accept a remark and your agent gets it.
- ✅ **Mark a file reviewed.** The mark lapses when the agent rewrites it.
- 🗺️ **Ask for a reading order.** adiff checks it covers every change.
- 🤖 **Every key is also a command**, and every command answers JSON.
- 🪟 **`adiff review pane`** puts the review beside your agent.

### Usage

1. Install adiff and its skill with the two commands above.
2. In your agent, run `/adiff layer this work and hand it over for review`.
3. Comment on the lines. The agent answers under your words, and `?` lists every key.

## Requirements

The commands run on Node 22 or newer. The terminal wants Node 26, which Homebrew brings along; on a
global npm install adiff finds a Node 26 among your fnm, nvm, asdf, volta and Homebrew installs and
runs the terminal on that.

## Notes

adiff is alpha, and one person's tool. Every release goes out under the `alpha` tag. The agent's
side of the loop is in [docs/handover.md](docs/handover.md), and the project docs live in `.agents/`:
`AGENTS.md` covers making a change, `ARCHITECTURE.md` how the code is laid out.

## License

MIT

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/Newbie012">
		<img src="https://cdn.jsdelivr.net/gh/newbie012/sponsors/sponsors.svg">
	</a>
</p>
