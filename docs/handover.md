# The handover, in detail

The loop an agent runs, and everything around it, is in the wiki:

- [The agent's side of the review](https://github.com/Newbie012/agent-diff/wiki/The-agent's-side-of-the-review),
  for `comment take`, `comment answer`, `review pane` and the `--wait` contract.
- [Layers](https://github.com/Newbie012/agent-diff/wiki/Layers), for the reading order, its document
  and its coverage.
- [The commands](https://github.com/Newbie012/agent-diff/wiki/The-commands), for the JSON envelope, the
  exit codes, and `comment send` and `comment list`.

`skills/adiff/SKILL.md` says the same in the form an agent reads, and it ships in the package. Install
it with `npx skills add Newbie012/agent-diff --skill adiff -g`.
