## 0.1.0-alpha.47

### Minor Changes

- `adiff upgrade` upgrades. It runs the command for the install it found instead of printing it, shows the package manager working, and ends by naming the version you now have. `--check` reports without running, `--run` still works and does nothing, and a route adiff cannot do for you, a downloaded binary or a checkout, explains why and exits 1.
