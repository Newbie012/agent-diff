## 0.1.0-alpha.43

### Patch Changes

- Build the Linux release binaries again. The terminal library ships one native package per platform and libc, and pnpm skips the musl ones on a glibc runner, so the compiler could not find the musl library it still has to bundle and both Linux builds stopped there. Installs now take both libc flavours, and every pull request compiles all four binaries and checks they answer with no runtime on PATH, so a broken binary shows up before a release does. The release also tracks the newest Bun rather than a pinned one.
