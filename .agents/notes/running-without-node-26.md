# Running the terminal without Node 26

adiff's commands run on Node 22. Opening the terminal needs Node 26, because the renderer reaches
its native library through `node:ffi`, which Node exposes from 26 onward and only behind a flag. The
launcher searches a machine for a Node 26 and re-execs through it, and the Homebrew formula carries
its own. Both work, and both are ways of coping with a requirement most people have not met.

This note reports what happens when the same product runs on Bun, which has FFI built in.

## The terminal runs on Bun today

The renderer package publishes a Bun build beside the Node one, and its export map selects it:

```json
"exports": { ".": { "bun": "./index.bun.js", "node": "./index.node.js" } }
```

Running the frame capture under Bun draws every screen, including the seeded layers, which are
written by CLI subprocesses that Bun also runs. Nothing was changed to make that work.

Under Bun, `process.getBuiltinModule("node:ffi")` is undefined, because Bun's FFI is its own module.
The launcher reads that check to decide whether the current runtime can draw, so it would conclude
it cannot and go looking for a Node 26 that Bun does not need.

## A single executable works, and embeds what it needs

```
bun build --compile --target=bun-darwin-arm64 src/main.ts --outfile adiff
```

The result is one file that runs with no Node and no runtime on the machine. Driven through a pty
with `PATH=/usr/bin:/bin`, where `which node` finds nothing, it drew the worktree list and moved
between rows.

Two parts usually break when a bundler swallows a package like this, and neither did. The native
library is embedded because the renderer's Bun build imports it as a file:

```js
const module = await import("./libopentui.dylib", { with: { type: "file" } })
```

The tree-sitter grammars are embedded the same way, and syntax highlighting survives: opening a diff
in the compiled binary paints eight distinct foreground colours, including the keyword violet that
only appears once a parse has run.

## What it costs

The binary is 66 MB, and 65 MB with `--minify`, so the bulk is the runtime rather than the product.
`--bytecode` fails on a parse error inside the renderer's own bundle.

Startup is the real cost. Measured on a heavily loaded machine, so read the ratio rather than the
figures: `adiff describe` took about 2.5 seconds from the compiled binary against about 0.6 seconds
from Node with the built bundle. An empty compiled binary starts in 0.02 seconds, so the runtime is
not the cause. A binary whose only statement imports the renderer costs about the same as the whole
product, which places the cost in materialising the embedded native library and grammars on every
run.

That matters here more than it would elsewhere, because agents call the CLI once per command, and
every JSON command was paying for a renderer it never used.

## What this found in the product

`src/main.ts` imported the terminal at the top, so `describe`, `comment take` and every other JSON
command loaded the renderer and its native library before answering. Importing it on the one path
that draws a terminal roughly halved the compiled binary's startup and helps the Node package too.
That change is in this branch and stands on its own, whatever is decided about runtimes.

## Cross compilation

Building for other platforms needs each platform's native package present, since the renderer
resolves them by import. Adding them as development dependencies gets past that, and the build then
stops on `Target platform 'bun-linux-x64-v1.4.0' is not available for download`, because this
machine runs a canary Bun and canary targets are not published. A release would build each platform
on its own runner regardless, which avoids the question.

## What would change

The npm package keeps working exactly as it does now, which matters because agents install that way
and `adiff init` assumes the command is on the path. A compiled binary is an addition rather than a
replacement.

The test suite drives the renderer through Node and would stay there. The release workflow would
grow a job per platform, attaching binaries to the GitHub release. The Homebrew formula could
install a binary instead of the npm tarball, which would drop its dependency on Node 26. The version
string is read by climbing to `package.json`, which does not exist inside a compiled binary, so it
reports `unknown` and would need embedding at build time.

## The alternatives, briefly

Waiting for Node 26 to become common costs nothing and fixes itself, but not this year. Bundling a
runtime into the npm package trades the same size for a worse install. A renderer that does not need
FFI is not on offer. Keeping the constraint and writing an excellent failure message is what the
product does now, and the launcher already does it well.

## Recommendation

Ship the compiled binary as a second route, for people who have no Node and do not want any. Keep
npm as the route for people who do, and for agents. That way the terminal becomes reachable with a
download, without asking anyone to install a runtime, and without disturbing the path that the skill
and `adiff init` depend on.

Two things to fix first, both small: the version reads `unknown` inside a compiled binary, and the
launcher's check for a usable runtime asks for `node:ffi` specifically, which a Bun build fails
despite being able to draw.
