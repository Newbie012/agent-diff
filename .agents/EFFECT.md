# How we write Effect here

Rules, not advice. Almost every rule below is an oxlint rule, named where it appears, and the linter
is the authority. Where a rule needs judgement it says so, with both sides shown, so nobody has to
guess which case they are in.

Run them with `pnpm lint`, which is three things: oxlint, including the project's own rules in
`tools/oxlint-adiff.ts`; `scripts/check-rules.ts`, which proves each of those rules still fires
against a file in `tools/fixtures` that violates it; and `pnpm lint:effect`, which is
`@effect/tsgo` reading types to catch what an AST cannot see.

Those type-aware rules are the ones worth knowing by name. `floatingEffect` catches an Effect that is
built and never run. `missingEffectError` catches an error channel nobody handles.
`missingEffectContext` catches a requirement nobody provides. All three are the silence this product
keeps being bitten by, and none of them is visible without a type checker.

`src/service/forge/` is the worked example. It is sixty lines and every rule below appears in it.

## Services

A service is a `Context.Service` over a `Shape` type, with the shape written out above it:

```ts
export type Shape = {
  readonly pulls: (repo: string) => Effect.Effect<ReadonlyArray<Pull>, ForgeUnavailable>
}

export class Forge extends Context.Service<Forge, Shape>()("adiff/Forge") {}
```

The tag reads `adiff/Name`. **Rule:** `adiff/service-tag`.

A layer is built once per service and exported with a `Live` suffix, or a factory when it takes
configuration: `ForgeLive`, `GitLive`, `storeAt(root)`. The layer is the only place a shape is
constructed. Nothing else builds one.

Dependencies arrive through the context, never through a constructor argument or a module-level
singleton. One place provides them: `src/main.ts` for the CLI, the driver for tests.

## Errors

An error is a `Data.TaggedError` in the module's `error.ts`, carrying the facts a caller needs to
say something useful:

```ts
export class ForgeUnavailable extends Data.TaggedError("ForgeUnavailable")<{
  readonly repo: string
  readonly reason: string
}> {}
```

Every failure a service can produce appears in its signature. A service never swallows a failure to
keep its signature clean. **The place that has a truthful answer handles it, and that is usually not
the service.** Forge fails when `gh` is missing; the terminal catches that failure and says it
could not find out, because "we cannot tell" is the truthful answer there and an empty column
would read as "there is none":

```ts
asked.pipe(Effect.catchTag("ForgeUnavailable", () => Effect.succeed([])))
```

Handle by tag. `Effect.catchAll` and cause-level recovery need a reason in the PR.

## Effects

`Effect.gen` is the default for anything with more than one step. `pipe` is for a single
transformation of an effect you already have, as in the `catchTag` above.

Public service methods and anything non-trivial use `Effect.fn` with a span named
`Area.operation`, where `Area` is the module: `Forge.pulls`, `Store.stage`, `Review.listBranches`,
`Main.branchList`. **Rule:** `adiff/span-name`.

`src/domain` and `src/service` contain no promises: no `async`, no `await`, no `new Promise`. Wrap a
callback API in `Effect.callback` and a promise API in `Effect.promise` or `Effect.tryPromise`, at
the point where it enters. **Rule:** `adiff/effect-not-promises`, on `domain` and `service`.

Untrusted input is decoded, not cast. `gh` output goes through `Schema.decodeUnknownEffect`; a
`JSON.parse` result is `unknown` until a schema says otherwise.

## State

State that a fibre reads and writes lives in a `Ref`, or a `SubscriptionRef` when something needs to
watch it. A plain mutable field is for values that never cross a fibre boundary.

## Where Effect meets opentui

opentui renderables are mutable objects and keypresses arrive as callbacks, so `src/tui` is the one
place that holds a runner rather than composing effects. The boundary is a single captured
`Effect.runPromiseWith`, and everything the terminal needs from the rest of the program goes through
it. The terminal builds no effects of its own beyond calling one.

That is the current shape, not the intended one. See ADR-005.

## Spacing, imports, layout

- One blank line separates declarations. Never two. **Rule:** `adiff/one-blank-line`.
- A block never opens or closes on a blank line. **Rule:** `adiff/blank-at-edges`.
- No blank lines inside a run of imports. Judgement, not a rule: a blank line there reads as a
  grouping nobody agreed on.
- Imports run `node:` builtins, then packages, then relative paths. **Rule:** `adiff/import-order`.
- No comments in `src/`. A comment explaining code is a defect report against the code. The only
  exceptions are `// ARRANGE`, `// ACT`, `// ASSERT` in tests. **Rule:** `adiff/no-comments`, which takes `{ sections: true }` in tests.
- No import reaches past another module's `index.ts`. **Rule:** `adiff/module-boundary`.
- A module is a directory with `index.ts` as its entire public surface. Types live beside the code
  that owns them: a service's `Shape` in `service.ts`, its errors in `error.ts`, its data in
  `model.ts`.
- Several exports per file is fine. One export per file is not a goal.

## Naming

- Services are nouns: `Store`, `Git`, `Forge`.
- Layers are the service plus `Live`, or a factory named for what it takes: `storeAt`.
- Effect-returning functions are verbs: `pulls`, `stage`, `listBranches`.
- Predicates read as questions: `isKnown`, `needsAttention`.
- No abbreviations that are not already words here: `repo` yes, `cfg` no.

## Needs judgement

Two rules cannot be mechanical, so they are stated with both sides.

**How much goes in one `Effect.gen`.** A generator that reads as a paragraph is right; one that
needs a scroll is two functions. Forge splits `ask` from `read` because fetching and decoding fail
for different reasons and each wants its own error:

```ts
const pulls = Effect.fn("Forge.pulls")(function* (repo: string) {
  const raw = yield* ask(repo)
  return yield* read(repo, raw)
})
```

Inlining both would be one function with two responsibilities and a wider error type than either
half needs.

**When a failure is worth its own tag.** A new tag earns itself when a caller would act differently
on it. `UnknownBranch` and `UnknownFile` are separate because the terminal says different things.
`ForgeUnavailable` covers a missing `gh`, a timeout and unreadable output together, because every
caller does the same thing with all three.
