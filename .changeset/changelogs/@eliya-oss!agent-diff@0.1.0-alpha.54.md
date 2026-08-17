## 0.1.0-alpha.54

### Patch Changes

- A review now follows its branch instead of the folder it was read in. State was keyed on the worktree path, so renaming a worktree — or checking the same branch out somewhere else — left the entire review behind with nothing on screen to say it had happened. The key is the repository and the branch now, where the repository is the common git directory every worktree of it shares, so all the worktrees of one repo agree on where a review lives and different branches still keep their own. A store written under the old key is adopted the first time the branch is opened, so nothing already written is stranded.

- Comments handed to an agent that never answered them are no longer lost. The cursor advanced the moment `comment take` read a comment, so an agent that collected five and answered three left two that nothing would ever hand over again — and the terminal went on showing them as sent, with no sign anything was wrong. An answer is what retires a comment now, so one the agent dropped comes back on its next take and keeps coming back until it is answered. Settling or removing retires it too, since both are the reviewer saying they no longer need one. The branch list counts what the agent still owes rather than what it has yet to read, which is the number that was missing when a comment went quietly missing.
