## 0.1.0-alpha.87

### Patch Changes

- Marking a file reviewed no longer re-reads the whole branch from git, taking it from about 124ms to about 37ms on a branch of 131 files.
