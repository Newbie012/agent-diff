## 0.1.0-alpha.122

### Patch Changes

- A file with no newline at the end says so. git reports it and adiff dropped the line, so the change to a file's last byte showed as two lines that read identically with nothing to tell them apart.

  The lock around a review's state is patient enough for a loaded machine. Four writers arriving at once on a busy box could exhaust its retries and lose a write.
