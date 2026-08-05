# ADR-005 - Style is a lint rule, not a document

- **Status:** `accepted`
- **Date:** 2026-08-05
- **ADRs:** amends [ADR-002](ADR-002-effect-v4-and-module-boundaries.md)

## Context

ADR-002 chose Effect v4 throughout. Ten days later the domain, service and CLI layers hold to it and
`src/tui` does not: thirty files of plain TypeScript, promises serialised through one chain, mutable
renderable objects. That was never a recorded decision. It is drift, and this ADR names it as such
rather than pretending it was a design.

Drift is the interesting part. This repo is written almost entirely by agents, several at once, and
each writes competent code in a slightly different dialect. Read ten files and you can count the
authors: some reach for `pipe`, some for `Effect.gen`; some name a span after the file, some after
the module; one swallows a failure to keep a signature narrow, the next threads it through. None is
wrong alone. Together they are a codebase nobody recognises, where review attention goes on shape
instead of substance.

The same pull shows up in the smallest things. Two blank lines here, one there. A local import above
the package imports. A service tag with a prefix, another without. Each is beneath mentioning in
review, which is exactly why they accumulate.

## Decision

The way we write code is expressed as lint rules, in `tools/oxlint-adiff.ts`, and the document
`.agents/EFFECT.md` explains the rules rather than substituting for them.

Nine rules run inside oxlint through its JS plugin API. Six are new; three are the rules that used
to live in `scripts/check-style.ts`, which is deleted, because oxlint can now express what it could
not when that script was written.

`scripts/check-rules.ts` runs the plugin against `tools/fixtures`, one file per rule, each violating
exactly the rule it is named after, and fails if any rule does not fire. `pnpm lint` runs that proof
before it lints real code.

Type-aware Effect diagnostics run too, from `@effect/tsgo`, as `pnpm lint:effect` inside `pnpm lint`.
Seven of its rules are errors here, among them `floatingEffect`, `missingEffectError` and
`missingEffectContext`, which catch exactly the silence ADR-002 was written about: an Effect that is
never run, an error channel nobody handles, a requirement nobody provides.

Only judgement calls stay prose: how much belongs in one `Effect.gen`, and when a failure earns its
own tag. Both are stated with an example of each side.

## Rationale

An agent reads the code around it and writes more of the same. That makes convention self-enforcing
once it holds and self-defeating while it does not: one promise in `src/service` is a licence for the
next agent to add another. The way to spend that property rather than fight it is to make the first
file right and let the linter keep it that way.

The rules live in the linter rather than a checker because the linter is what an agent already runs,
what an editor already surfaces, and what reports a file, a line and a rule name without anyone
writing that plumbing. oxlint's JS plugins reached alpha recently and are ESLint-shaped, so a rule is
a visitor over the AST with `context.report`, and the whole plugin is one file.

Enforcement is proven because a rule that silently stops matching is worse than no rule. Three times
in the past week a test in this repo passed while the feature it named was absent. A style rule has
the same failure mode with nobody watching for it. Nine fixtures cost nine short files, and the proof
caught a real break while it was being written: inverting one condition in the plugin made
`service-tag` stop firing, and `check-rules` failed as it should.

## Alternatives Considered

- **A style guide without enforcement.** ADR-002 said "Effect throughout" and `src/tui` is what
  happened. Prose does not hold a line.
- **Keeping `scripts/check-style.ts`.** It worked, and it was a second thing to learn, with its own
  output format and no editor integration. Everything it did is now a lint rule.
- **`@effect/language-service` inside oxlint.** Two dead ends and one road. Its diagnostics need the
  TypeScript type checker, and an oxlint JS plugin sees an AST with no type information, so it cannot
  run as a plugin. It also refuses this repo outright: it supports TypeScript 5 and 6, and adiff is on
  7. Its successor for TypeScript 7 is `@effect/tsgo`, which is what we use. That does ship an oxlint
  patch for surfacing its rules through oxlint, but its own CLI already reports in oxlint's format and
  needs no patching, so the patch buys nothing here.
- **Prettier or dprint for the spacing rules.** A formatter settles blank lines and import order more
  reliably than a rule and ends the argument. It would also reformat all 143 files at once, because
  the repo has no formatter and its line breaks are hand-placed, often better than a formatter's
  output. Worth doing alone, so the reformatting diff is nothing but reformatting.
- **Converting `src/tui` in this pass.** The contract would have been written to match whatever the
  conversion produced, which is backwards.

## Consequences

- Nine rules are mechanical. Violating one gets a file, a line and a rule name from the tool an agent
  already runs.
- `src/tui` passes every mechanical rule while failing the spirit of the contract, because
  `adiff/effect-not-promises` is scoped to `domain` and `service`. That is deliberate and temporary:
  widening the scope to `tui` is how the next pass knows it is finished.
- A new rule costs a fixture. That is the price of the proof and it is the right price.
- oxlint's JS plugins are alpha and not under semver, so an oxlint upgrade can break the plugin. The
  proof turns that from a silent loss of enforcement into a failed build.
- `pnpm lint` now typechecks twice over, once for `tsc` and once for the Effect diagnostics, which
  costs a few seconds. `@effect/tsgo` can run inside the `tsc` pass instead, which is worth doing if
  the wait starts to matter.

## Revisit When

- A formatter lands, and the spacing rules become its job.
- `src/tui` is converted and the promise ban can cover all of `src`.
- `@effect/tsgo` gains a way to read its diagnostics config from `tsconfig.json` in CLI mode. Today it
  ignores the plugin block there and the config is repeated inline in `package.json`, so the editor
  and the gate are configured twice.
- A rule blocks something legitimate more than once, which is the signal it was taste dressed as
  mechanics.
