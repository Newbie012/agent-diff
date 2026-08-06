## 0.1.0-alpha.42

### Minor Changes

- Renames on the merits, now that nothing depends on the old names: `comment threads` is `comment list`, `comment add` is `comment send`, `review submit` is `review send`, `file vouch` is `file review`, and `--asks` is `--question`. `comment drop` is gone, folded into `comment remove`. Every command that acts on a review now takes either `--worktree`, or `--repo` with `--branch`.

### Patch Changes

- `--help` works on every command and every noun, the top-level list is grouped by what you are trying to do, a mistyped command names the one you meant, and a missing option says which command wanted it.
