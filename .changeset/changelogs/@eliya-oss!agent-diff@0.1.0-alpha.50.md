## 0.1.0-alpha.50

### Patch Changes

- `adiff upgrade` says the command it ran and the version it landed on, and stops there. It used to open with which package manager installed the build, which registry tag mattered and what it was about to do, which is four paragraphs standing between you and the one fact you asked for. Upgrading now also rewrites the adiff skill wherever it is already installed, so an agent is not left reading last month's instructions; `adiff skill refresh` does that on its own, and neither installs a skill that was not already there.
