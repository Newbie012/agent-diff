# ADR-001 - Node 26 with --experimental-ffi as the runtime

- **Status:** `accepted`
- **Date:** 2026-08-02
- **PRDs:** [PRD 009](../prd/009-runtime-and-configuration.md), [PRD 003](../prd/003-review-terminal.md)

## Context

adiff renders a syntax-highlighted diff in a terminal. opentui does that well, and its diff and
scroll primitives are the reason a review terminal is a few hundred lines rather than a few
thousand. opentui draws through a native library and reaches it over FFI.

Bun was ruled out as the runtime by the project's own constraint: adiff targets Node. That left the
question of whether Node can talk to opentui's native renderer at all, and the answer differs by
version. Node 24 has no `node:ffi` — not stabilised, not flagged, not present. Node 26 exposes it
behind `--experimental-ffi`.

This was discovered after the terminal was written, when the first screen test failed with
"OpenTUI native FFI is not available for this runtime yet".

## Decision

adiff requires Node 26 or newer and passes `--experimental-ffi` from every entry point:
`bin/adiff.js` in its shebang, the npm scripts on their command line, and the test driver when it
spawns the binary. `.node-version` pins 26 and `engines.node` declares `>=26`.

## Rationale

It is the only combination that runs. Given that, the remaining choice was whether to make the
operator supply the flag or to supply it everywhere, and an experimental flag the user has to know
about is a support burden with no upside — nothing about adiff's behavior changes with it, so there
is nothing for the operator to decide.

## Alternatives Considered

- **Bun.** Runs opentui without a flag, and the prototype used it. Rejected: the project targets
  Node, explicitly including "not even bun 1.4".
- **Node 24 with a different renderer.** Would mean writing the diff renderer, syntax highlighting,
  and scrolling by hand — the bulk of what opentui provides, and the part with the most subtle
  bugs.
- **Node 24 with opentui in a Bun subprocess.** Two runtimes, an IPC boundary in the middle of the
  render loop, and a Bun dependency anyway.
- **Waiting for `node:ffi` to stabilise.** No date, and adiff cannot draw until then.

## Consequences

- Contributors need Node 26. `.node-version` makes that automatic for fnm and nvm users.
- The flag is invisible in normal use and unavoidable in abnormal use: `node src/main.ts` without
  it fails on Node's own error, which is clearer than the renderer's.
- Node runs TypeScript by stripping types. There is no build step, and syntax requiring emit does
  not run — see [ADR-002](ADR-002-effect-v4-and-module-boundaries.md).
- adiff inherits an experimental API. A breaking change to `node:ffi` breaks the terminal, though
  not the command surface.

## Revisit When

- `node:ffi` stabilises and the flag can be dropped.
- opentui ships a non-FFI path for Node.
- A breaking `node:ffi` change lands and the cost of tracking it exceeds the cost of the renderer
  alternatives above.
