# Installing adiff

adiff needs Node 22 or newer for its commands. Opening the terminal needs Node 26, because it draws
through a native renderer that Node exposes from 26 onward. The launcher finds a Node 26 on your
machine when it needs one, so a version manager holding several versions is fine.

## npm

```bash
npm i -g @eliya-oss/agent-diff@alpha
```

Every release goes out under the `alpha` tag while the tool is pre-1.0, so name the tag.

## bun

```bash
bun add -g @eliya-oss/agent-diff@alpha
```

bun installs the package; adiff itself runs on Node.

## Homebrew

```bash
brew install Newbie012/tap/adiff
```

The formula brings its own Node 26, so the terminal works without one on your PATH.

## From source

```bash
git clone https://github.com/Newbie012/agent-diff.git
cd agent-diff
npm install -g --allow-scripts=pnpm pnpm@next-12
pnpm install
pnpm review
```

`pnpm simulate` opens the terminal on a throwaway repository of worktrees an agent has already
worked on, which is the quickest way to see it without a review of your own.
