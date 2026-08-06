# Shipping a compiled binary

`running-without-node-26.md` found that the whole product compiles into one file with Bun, runs with
no Node on the machine, and recommended shipping that as a second route. It ended with two things to
fix first. Both are fixed in this branch, and remeasuring changed the answer to the question that
mattered most.

## The two prerequisites

The version used to be found by climbing up to five directories looking for a `package.json`, which
does not exist inside a compiled binary, so the binary answered `unknown`. It now comes from
importing the manifest:

```ts
import manifest from "../../package.json" with { type: "json" }

export const version = (): string => manifest.version
```

Both bundlers fold that to the string at build time. Rolldown tree-shakes the rest of the manifest
away, so `dist/main.js` carries the version and nothing else from it, and stays the same size. The
compiled binary and the npm bundle both report `0.1.0-alpha.37`.

This works because every route builds after the version is bumped. The release workflow runs
`pnpm version -r` before `pnpm build`, and `prepack` builds on a hand publish.

The launcher decided whether the current runtime could draw by asking for `node:ffi`. Under Bun that
is undefined, because Bun's FFI is its own module, so the check said no. It now says:

```js
const rendersHere = () =>
  process.versions.bun !== undefined ||
  (typeof process.getBuiltinModule === "function" &&
    process.getBuiltinModule("node:ffi") !== undefined)
```

Bun reports `process.versions.node` as 26.3.0, so the old code did not fail outright — it re-execed
Bun as a subprocess of itself, passing Node flags Bun ignores. It worked by accident and paid for a
second process start. This matters for `bun install -g`, which the README offers, because that is the
route where a person reaches `bin/adiff.js` under Bun.

## Startup is not a problem

The spike measured about 2.5 seconds for the binary against 0.6 seconds for Node, and said to read
the ratio because the machine was loaded. The ratio was wrong too. On an idle machine, ten runs of
`adiff describe`, repeated three times:

|        | first pass | warm |
| ------ | ---------- | ---- |
| node   | 83 ms      | 83 ms |
| binary | 130 ms     | 55 ms |

The binary is faster than Node once the file is in the page cache, and pays about 75 ms extra the
first time while 67 MB pages in. Nothing needs doing about startup. The lazy import of the terminal,
which the spike added so JSON commands stop loading the renderer, is what fixed this and is already
on main.

## Build each platform on its own runner

Cross-compiling from one machine does not work, and not for the reason the spike gave. It blamed a
canary Bun; on stable Bun 1.4.0 the build stops earlier, on resolution:

```
error: Could not resolve: "@opentui/core-linux-x64". Maybe you need to "bun install"?
```

Adding that package as a development dependency gets one step further and then asks for
`@opentui/core-linux-x64-musl`, and pnpm resolved it at 0.5.1 against a renderer pinned at 0.4.5.
Chasing this means carrying every platform's native package as a development dependency, pinned by
hand to match the renderer, and keeping them in step forever.

A runner per platform avoids all of it. A normal `pnpm install` on a Linux runner pulls the Linux
native package at the right version, because that is what optional dependencies are for. It is also
the only way to know the Linux binary works, which nobody has checked — the spike only ran a
macOS arm64 build.

## How it ships

**GitHub release, one asset per platform.** `macos-14` for darwin-arm64, `macos-13` for darwin-x64,
`ubuntu-latest` for linux-x64, and linux-arm64 if a runner is available. Each runner installs, builds
its own target, and uploads the binary. The release is cut against the `v$VERSION` tag the workflow
already pushes; no GitHub release is created today, so that is a new step.

**Homebrew installs the binary, not the npm tarball.** The formula today points at the npm tarball
and therefore depends on Node 26. Pointed at the release assets instead, with `on_macos`/`on_intel`
blocks carrying a url and sha256 each, it drops that dependency entirely and `brew install adiff`
stops caring what runtimes are on the machine. This is the whole point of the exercise: brew is the
route for people who do not have Node and do not want it.

**npm does not change.** Agents install that way and `adiff init` assumes `adiff` is on the path.
The publish job stays exactly as it is.

**Workflow shape.** The binaries belong in jobs that run after the publish job and cannot affect it.
If a platform's build fails, npm has already published and the release simply lacks that asset. The
formula update moves out of the publish job into a job that waits for the binaries, so brew is never
pointed at assets that are not there. That does mean the formula lags npm by the length of a build
when the binary jobs are slow, which is the right way round: a stale formula is better than a broken
one.

## What is still open

Nobody has run the Linux binary. The 67 MB download is mostly Bun's runtime, and `--minify` saves
1 MB, so there is nothing to win there. `--bytecode` still fails on a parse error inside the
renderer's own bundle, which would have cut startup further if it worked.
